// Jack Rabbit Slims chat room
/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, unused:true, curly:true, indent:false */
/*global jQuery:false, Firebase:false, document:false */

(function($) {
	"use strict";

  var DATABASE = 'https://jrslims.firebaseIO.com/';
  var KEEPNUM = 150;  // number of posts to keep
  var KEEPTIME = 86400000;  // one day

  var id; // userid
  var me; // user object
  var lastseen = 0; // last post I've seen
  var online = true;  // am I connected to Firebase?
  var messages = [];  // message names
  var files = []; // uploaded files for a message
  var shift = false;  // is shift key down?

  getParams('?'+document.cookie); // params from cookies
  getParams(window.location.href); // params from URL override

  // determine user id
  if (id === undefined) {
    var t = prompt('Enter your id');
    if (t.length > 0) {
      id = t;
      setCookie('id', id);
    }
  }

  // firebase references
  var firebasedb = new Firebase(DATABASE);
  var connectdb = firebasedb.child('.info/connected'); // connected
  var msgdb = firebasedb.child('messages'); // list of messages
  var usersdb = firebasedb.child('users');  // all user profiles
  var usrdb = usersdb.child(id);  // my profile

  // get user profile
  usrdb.once('value', function(snap) {
    me = snap.val();  // user profile
    lastseen = me.lastseen || 0;

    // get messages
    msgdb.on('child_added', function(snap) {
      var message = snap.val();
      var d = message.stamp; // new Date(message.stamp);
      messages.push(snap.name());  // keep track of messages
      var newdiv = $('<div/>', {'class': 'msgdiv'}).
        append($('<strong/>').text(message.name)).
        append($('<span/>', {'class': 'msgtime'}).data('mts', d).text(' - '+deltaTime((new Date()) - d)+' ago')).
        append($('<div/>').html(message.text)).
        prependTo($('#messagesDiv'));
      if (lastseen < d) {
        newdiv.css('background-color', '#ffc');
      }
    });

  }); // end get user profile and messages

  // manage whether I am connected or not, and timestamp when I disconnect
  connectdb.on('value', function(snap) {
    if (snap.val() === true) {  // online
      online = true;
      $('#kibbitz').css('opacity', 1.0);
      $('#status').text('');
      var onlinedb = usrdb.child('online');
      onlinedb.onDisconnect().set(Firebase.ServerValue.TIMESTAMP);  // time of disconnect
      onlinedb.set(true); // I am online
    } else {  // offline
      online = false;
      $('#kibbitz').css('opacity', 0.3);  // dim kibbitz button
      $('#status').text('offline');
    }
  });

  // manage list of online users
  usersdb.on('value', function(snap) {
    var l = '';
    var lurker = '';
    var lurktime = 0;
    snap.forEach(function(csnap) {
      var name = csnap.name();
      if (name !== id) {  // not me
        if (csnap.val().online === true) {
          l += ' '+name;  // list on online users
        } else {
          if (lurktime < +csnap.val().online) { // most recent lurker
            lurker = name;
            lurktime = +csnap.val().online;
          }
        }
      }
    });
    $('#others').text(l.length > 0 ? 'Connected: ' + l :
      'Last lurk: ' + lurker + ' - ' + deltaTime(new Date() - lurktime) + ' ago');
  });

  $(document).ready(function() {
    $('#nameInput').text(id);

    // grow textarea automatically
    $('#messageInput').on('keyup keydown', function(e) {
      if (e.which === 16) { // SHIFT
        shift = (e.type === 'keydown');
        return;
      }
      if (e.which === 13) { // RETURN
        if (shift && e.type === 'keyup') {
          $('#kibbitz').click();
        }
      }
      var el = e.delegateTarget;
      if (el.scrollHeight > el.clientHeight) { el.style.height = el.scrollHeight+'px'; }
    });

    $('#kibbitz').click( function() {  // post new message
      if (!online) { return; }  // do nothing if not online (should save message!)
      var name = $('#nameInput').text();
      var mess = $('#messageInput').val();
      if (name.length === 0 || mess.length === 0) {
        return;
      }
      msgdb.push({
        name: name,
        text: mess.replace(/\r\n|[\n\r\x85]/g, '<br />'),
        stamp: Firebase.ServerValue.TIMESTAMP,
        files: files.join("\n")
      });
      files = [];
      $('#messageInput').val(''); // clear message text
      $('.qq-upload-list').empty(); // clear list of uploaded files

      while (messages.length > KEEPNUM) {  // might need to delete an old message
        var fdb = msgdb.child(messages[0]);
        fdb.once('value', function(snap) {
          console.log('deleted: ', snap.name());
          var m = snap.val();
          if ((new Date) - m.stamp > KEEPTIME) {
            if (m.files && m.files.length > 0) { // need to delete uploaded files
              $.each(m.files.split("\n"), function(i, v) {
                $.get('delete.php?file='+v);
              });
            }
            fdb.remove(); // delete message
            messages.shift(); // remove first element
          }
        });
      }
      uptime();
    });

    // formatting buttons
    $('#formatbuttons').on('click', 'span.button', function(e) {
      var el = e.target;
      switch(el.title) {
        case 'File Upload': break;
        case 'Link':        alink(); break;
        case 'Image':       img(); break;
        case 'Bold':        wrap('<b>','</b>'); break;
        case 'Italic':      wrap('<i>','</i>'); break;
        case 'Color':       wrap('<font color="red">', '</font>'); break;
        case 'Size':        wrap('<font size="+2">', '</font>'); break;
        case 'Block Quote': wrap('<blockquote>', '</blockquote>'); break;
      }
    }). // color button blue during click
      on('mousedown', 'span.button', function(e) { $(e.target).css('background-color', '#bbf'); }).
      on('mouseup', 'span.button', function(e) { $(e.target).css('background-color', 'white'); });

    // click to mark post as read
    $('#messagesDiv').on('click', '.msgdiv', function() {
      var $this = $(this);
      lastseen = $this.css('background-color', '#fff').find('.msgtime').data('mts');
      $this.nextAll().css('background-color', '#fff');
      usrdb.update({'lastseen': lastseen});
      uptime();
    });

    // drag and drop file uploader
    $('#fine-uploader').fineUploader({
      // uploaderType: 'basic',
      debug: true,  // turn off for production
      request: { endpoint: 'endpoint.php' },
      retry: { enableAuto: true },
      button: document.getElementById('fileup'),
      ios: true
    }).on('complete', function(event, id, fileName, responseJSON) {
      if (responseJSON.success) {
        files.push(responseJSON.uploadName);
        var suffix = fileName.slice(1+fileName.lastIndexOf('.')).toLowerCase();
        if (suffix==='jpg' || suffix==='jpeg' || suffix==='png' || suffix==='gif') {
          insert('<img class="userimg" src="files/'+responseJSON.uploadName+'" />');
        } else {
          insert('<a href="files/'+responseJSON.uploadName+'" target="_blank">'+fileName+'</a>');
        }
      }
    });

  }); // end document ready

  function pl(v) { // plural
    return ((v !== 1) ? 's' : '');
  }

  function deltaTime(d) { // how long ago?
    d /= 1000;
    if (d<0) { d = -d; }
    var year = Math.floor(d/31536000);
    var week = Math.floor((d%31536000)/604800);
    if (1<=year) { return year+' year'+pl(year)+' '+week+' week'+pl(week); }
    var weekday = Math.floor((d%604800)/86400);
    var day = Math.floor(d/86400);
    if (30<day) { return week+' week'+pl(week)+' '+weekday+' day'+pl(weekday); }
    var hour = Math.floor((d%86400)/3600);
    if (1<=day) { return day+' day'+pl(day)+' '+hour+' hour'+pl(hour); }
    var minute = Math.floor((d%3600)/60);
    if (1<=hour) { return hour+' hour'+pl(hour)+' '+minute+' minute'+pl(minute); }
    var second = Math.floor(d%60);
    if (1<=minute) { return minute+' minute'+pl(minute)+' '+second+' second'+pl(second); }
    var tenth = Math.floor((d%1)*10);
    var hund = Math.floor(((d*10)%1)*10);
    return second+((second<10)?('.'+tenth+(second===0?hund:'')):'')+' seconds';
  }

  function uptime() {  // update message times
    var now = new Date();
    $('.msgtime').each(function() {
      var el = $(this);
      el.text(' - '+deltaTime(now-el.data('mts'))+' ago');
    });
  }

  function getParams(p) { // read from URL parameters or cookie
    var params = {}; // parameters
    p.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { params[key] = value; });

    if (params.id) { id = params.id; }
  }

  function setCookie(name, value) {
    var date = new Date();
    date.setTime(date.getTime() + 730*86400000); // 2 years
    document.cookie = name+'='+value+'; expires='+date.toGMTString()+'; path='+window.location.pathname;
  }

  // functions for manipulating and formatting messages
  function insert(str) {  // insert str into message
    var el = $('#messageInput')[0];
    el.focus();
    if (el.setSelectionRange) { // not IE
      var ss = el.selectionStart;
      el.value = el.value.substring(0, ss) + str + el.value.substring(el.selectionEnd, el.value.length);
      el.selectionStart = el.selectionEnd = ss + str.length;
    } else {
      document.selection.createRange().text = str;
    }
  }

  function wrap(ts, te) { // wrap message text selection in tags ts and te
    var el = $('#messageInput')[0];
    el.focus();
    if (el.setSelectionRange) { // not IE
      var ss = el.selectionStart;
      var se = el.selectionEnd;
      var sel = el.value.substring(ss, se);
      el.value = el.value.substring(0, ss) + ts + sel + te + el.value.substring(se, el.value.length);
      el.selectionStart = el.selectionEnd = ss + ts.length + (sel.length === 0 ? 0 : sel.length + te.length);
    } else {  // IE      
      var selected = document.selection.createRange().text;
      document.selection.createRange().text = ts + selected + te;
    }
  }

  function img() {  // insert image tag into message
    var el = $('#messageInput')[0];
    el.focus();
    if (el.setSelectionRange) { // not IE
      var ss = el.selectionStart;
      var se = el.selectionEnd;
      var sel = el.value.substring(ss, se);
      if (sel.length === 0) { sel = prompt('Enter Image URL:', 'http://'); }
      if (!sel) { return; }
      var tag = ' <img class="userimg" src="' + sel + '" /> ';
      el.value = el.value.substring(0, ss) + tag + el.value.substring(se, el.value.length);
      el.selectionStart = el.selectionEnd = ss + tag.length;
    } else {  // IE
      var selected = document.selection.createRange().text;
      if (selected.length === 0) { selected = prompt('Enter Image URL:', 'http://'); }
      if (!selected) { return; }
      document.selection.createRange().text = ' <img class="userimg" src="' + selected + '" /> ';
    }
  }

  function alink() {  // insert link tag into message
    var el = $('#messageInput')[0];
    el.focus();
    var lurl = '';
    if (el.setSelectionRange) { // not IE
      var ss = el.selectionStart;
      var se = el.selectionEnd;
      var sel = el.value.substring(ss, se);
      if (sel.length === 0) { sel = lurl = prompt('Enter Link URL:', 'http://'); }
      else { lurl = prompt('Enter URL for '+ sel + ':', 'http://'); }
      if (!lurl) { return; }
      var tag = '<a href="' + lurl + '" target="_blank">' + sel + '</a>';
      el.value = el.value.substring(0, ss) + tag + el.value.substring(se, el.value.length);
      el.selectionStart = el.selectionEnd = ss + tag.length;
    } else {  // IE
      var selected = document.selection.createRange().text;
      if (selected.length === 0) { selected = lurl = prompt('Enter Link URL:', 'http://'); }
      else { lurl = prompt('Enter URL for ' + selected + ':', 'http://'); }
      if (!lurl) { return; }
      document.selection.createRange().text = '<a href="' + lurl + '" target="_blank">'+ selected + '</a>';
    }
  }

}(jQuery));