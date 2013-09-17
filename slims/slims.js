// Jack Rabbit Slims chat room
/*jshint forin:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true,
  strict:true, undef:true, unused:true, curly:true, indent:false */
/*global jQuery:false, Firebase:false, document:false */

(function($) {
	"use strict";

  var DATABASE = 'https://jrslims.firebaseIO.com/';
  var KEEPNUM = 250;  // number of posts to keep
  var KEEPTIME = 86400000;  // keep posts for one day

  // profile data
  var id = ''; // userid
  var work = false; // work mode
  var email = '';  // email address
  var avatar = ''; // user icon

  // global variables
  var me; // user object
  var lastseen = 0; // last post I've seen
  var online = true;  // am I connected to Firebase?
  var messages = [];  // message names
  var files = []; // uploaded files for a message
  var shiftkey = false;  // is shift key down?
  var shame = []; // hall of shame users

  if (window.location.search.search(/^\?[\w% ]{1,}$/) === 0) {
    id = $.trim(decodeURIComponent(window.location.search.slice(1)));
  } else if (window.location.hash.search(/^#[\w% ]{1,}$/) === 0) {
    id = $.trim(decodeURIComponent(window.location.hash.slice(1)));
  } else {
    getParams(window.location.href); // params from URL
  }

  // determine user id
  while (id.search(/^[\w ]{1,}$/) !== 0) {
    var t = $.trim(prompt('Enter your ID (containing A-Z a-z 0-9 _ space):', id));
    if (t.length === 0) {
      t = 'INVALID';
      window.location.href = 'http://jrslims.com';
    }
    id = t;
  }

  $(document).ready(function() {

    $('#user').text(id);

    // firebase references
    var firebasedb = new Firebase(DATABASE);
    var connectdb = firebasedb.child('.info/connected'); // connected
    var msgdb = firebasedb.child('messages'); // list of messages
    var onoffdb = firebasedb.child('onoff');
    var usersdb = firebasedb.child('users');  // all user profiles
    var usrdb = usersdb.child(id);  // my profile

    // manage whether I am connected or not, and timestamp when I disconnect
    connectdb.on('value', function(snap) {
      if (snap.val() === true) {  // online
        online = true;
        $('#kibbitz').css('opacity', 1.0);
        $('#status').text('');
        var meonoffdb = onoffdb.child(id);
        meonoffdb.onDisconnect().update({ offline: Firebase.ServerValue.TIMESTAMP });  // disconnect
        meonoffdb.update({ online: Firebase.ServerValue.TIMESTAMP }); // I am online now
      } else {  // offline
        online = false;
        $('#kibbitz').css('opacity', 0.3);  // dim kibbitz button
        $('#status').text('offline');
      }
    });

    // manage list of online users
    // should use 'child changed' event instead of reprocessing the entire value !!!
    onoffdb.on('value', function(snap) {
      var l = '';
      var lurker = '';
      var lurktime = 0;
      shame = [];
      snap.forEach(function(csnap) {
        var name = csnap.name();
        var onoffval = csnap.val();
        shame.push({ name: name, online: onoffval.online, offline: onoffval.offline });
        if (name !== id) {  // not me
          if (onoffval.online > onoffval.offline) { // is online
            l += (l.length === 0 ? ' ' : ', ')+name;  // list of online users
          } else {
            var offnum = +onoffval.offline;
            if (lurktime < offnum) { // most recent lurker
              lurker = name;
              lurktime = offnum;
            }
          }
        }
      });
      $('#others').text(l.length > 0 ? 'Connected: ' + l :
        'Last lurk: ' + (lurktime === 0 ? 'none' : lurker ));
    });

    // get user profile and messages
    usrdb.once('value', function(snap) {
      me = snap.val();  // user profile
      if (me === null) {
        me = { lastseen: 0 };
        setTimeout(function() { usrdb.set(me); }, 10);
        $('#user').click();
      }
      if (me.lastseen !== undefined) { lastseen = me.lastseen; }
      if (me.work !== undefined) { work = me.work; }
      $('#logo').attr('class', work ? '' : 'show');
      if (me.email !== undefined) { email = me.email; }
      if (me.avatar !== undefined) { avatar = me.avatar; }

      // msgdb.endAt().limit(250).on('child_added', getmessages); // start getting messages
      msgdb.on('child_added', getmessages); // start getting messages
      msgdb.on('child_removed', dropmessages);  // remove from messages list
    }); // end get user profile

    function getmessages(snap) {  // get messages
      var message = snap.val();
      var d = message.stamp; // new Date(message.stamp);
      var memail = message.email || '';
      var name = memail ? '<a href="mailto:'+memail+'">'+message.name+'</a>' : message.name;
      messages.push(snap.name());  // keep track of messages
      var newdiv = $('<div/>', { id: snap.name(), 'class': 'msgdiv' });
      if (message.avatar) {
        $('<img/>', { 'class': 'avatar'+(work ? '' : ' show'), src: message.avatar }).appendTo(newdiv);
      }
      newdiv.append($('<strong/>').html(name)).
        append($('<span/>', {'class': 'msgtime'}).data('mts', d).
            html(' &ndash; '+deltaTime((new Date()) - d)+' ago')).
        append($('<div/>', { 'class': 'msgbody' }).html(message.text)).
        prependTo($('#messagesDiv'));
      if (d <= lastseen) {
        newdiv.css('background-color', '#ffc');
      }
    } // end get messages

    function dropmessages(snap) { // sync from Firebase
      var idx = messages.indexOf(snap.name());
      if (idx >= 0) { // found
        messages.splice(idx, 1);  // remove from messages list
      }
      $('#'+snap.name()).remove();  // remove message from DOM
    }

    // grow textarea automatically
    $('#messageInput').on('keyup keydown', function(e) {
      if (e.which === 16) { // SHIFT
        shiftkey = (e.type === 'keydown');
        return;
      }
      if (e.which === 13) { // RETURN
        if (shiftkey && e.type === 'keyup') {
          $('#kibbitz').click();
        }
      }
      var el = e.delegateTarget;
      if (el.scrollHeight > el.clientHeight) { el.style.height = el.scrollHeight+'px'; }
    });

    // post new message and delete old messages
    $('#kibbitz').click( function() {
      if (!online) { return; }  // do nothing if not online (should save message!)
      var name = $('#user').text();
      var mess = $.trim($('#messageInput').val());
      if (mess.length > 0 || files.length > 0) {  // message or files
        if (mess.length === 0) {  // files uploaded, but no message
          mess = 'Attachments:';
          $.each(files, function(i, v) {
            mess += ' <a href="'+v+'" target="_blank">'+v+'</a>';
          });
        }
        var post = {
          name: name,
          text: mess.replace(/\r\n|[\n\r\x85]/g, '<br />'), // newline -> break
          stamp: Firebase.ServerValue.TIMESTAMP
        };
        if (email) { post.email = email; }
        if (avatar) { post.avatar = avatar; }
        if (files.length > 0) { post.files = files.join("\n"); }
        // msgdb.push(post);
        var msgRef = msgdb.push();
        msgRef.setWithPriority(post, Firebase.ServerValue.TIMESTAMP);
        $('#messageInput').val(''); // clear message text
      }
      uptime();
      files = [];
      $('.qq-upload-list').empty(); // clear list of uploaded files
      $('.qq-upload-drop-area').hide(); // hide drop area if no files uploaded

      if (messages.length > KEEPNUM) {  // might need to delete an old message
        // dnum = Math.min(3, messages.length - KEEPNUM);
        // var olddb = msgdb.endAt(tsp);
        msgdb.once('child_added', oldmsg);
      }

      function oldmsg(snap) { // delete old message and files
        var m = snap.val();
        if (snap.val().stamp < (new Date()) - KEEPTIME) {  // should use priority
          // console.log('remove', snap.name());
          if (m.files && m.files.length > 0) { // delete uploaded files
            $.each(m.files.split("\n"), function(i, v) {
              $.get('delete.php?file='+v);
            });
          }
          snap.ref().remove();  // delete from Firebase
        }
      }

    }); // end click on kibbitz button (post new message)

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
    });

    // click to mark post as read
    $('#messagesDiv').on('click', '.msgdiv', function() {
      var $this = $(this);
      lastseen = $this.css('background-color', '#ffc').find('.msgtime').data('mts');
      $this.nextAll().css('background-color', '#ffc');
      setTimeout(function() { usrdb.update({'lastseen': lastseen}); }, 10);
      uptime();
    });

    // drag and drop file uploader
    $('#fine-uploader').fineUploader({
      // debug: true,  // turn off for production
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

    // emoticon menu
    function emo(e) {
      insert('<img src="'+$(e.target).attr('src')+'" />');
      $(document).off('click', cancelemo);
      $('#emoticons img').off('click', emo);
      $('#emoticons').hide();
      return false;
    }

    function cancelemo() {
      $(document).off('click', cancelemo);
      $('#emoticons img').off('click', emo);
      $('#emoticons').hide();
    }

    $('#emobutton').on('click', function() {
      $('#emoticons').show();
      $('#emoticons img').on('click', emo);
      $(document).on('click', cancelemo);
      return false;
    });

    // special characters menu
    function spc(e) {
      var c = $(e.target).html();
      var pos = c.search(/[FC]$/);
      if (pos === -1) {
        insert(c);
      } else {
        temperature(c.charAt(pos));
      }      
      $(document).off('click', cancelspc);
      $('#specialchars span').off('click', spc);
      $('#specialchars').hide();
      return false;
    }

    function cancelspc() {
      $('#specialchars span').off('click', spc);
      $(document).off('click', cancelspc);
      $('#specialchars').hide();
    }

    $('#spcbutton').on('click', function() {
      $('#specialchars').show();
      $('#specialchars span').on('click', spc);
      $(document).on('click', cancelspc);
      return false;
    });

    // Profile
    $('#user').click(function() {
      var table = '<img class="close" src="img/close_icon.gif" /><img id="Pimg" src="img/profile.png" />'+
          '<table><tr><td></td></tr><tr><td><span class="Ptext">rofile </span></td><td><span class="Ptext">for&nbsp;'+id+
          '</span></td></tr><tr><td>Work:</td><td><input id="work" type="checkbox" '+(work ? 'checked="checked" ' : '')+
          ' /></td></tr><tr><td>Email:</td><td><input id="email" type="text" value="'+
          email+'" /></td></tr><tr><td>Avatar:</td><td><img id="myavatar" src="'+
          avatar+'" width="39" height="50" /></td></tr></table><div id="cloakroom"></div>';
      $('#profile').show().on('click', 'img.close', cancelprofile).html(table);
      $('#work').change(function() {
        work = $(this).prop('checked');
        if (work) {
          $('#logo, div.msgdiv img.avatar').removeClass('show');
        } else {
          $('#logo, div.msgdiv img.avatar').addClass('show');
        }
        setTimeout(function() { usrdb.update({work: work}); }, 10);
      });
      $('#email').change(function() {
        email = $.trim($(this).val());
        setTimeout(function() { usrdb.update({email: email}); }, 10);
      });
      $('#myavatar').on('click', function() {
        if ($('#cloakroom img').length > 0) { return; }
        $.each(slimages, function(k, v) {
          $('<img/>', { src: 'avatars/'+k, title: v }).appendTo('#cloakroom');
        });
        $('#cloakroom img').on('click', function() {
          avatar = $(this).attr('src');
          var title = $(this).attr('title');
          $('#myavatar').attr('src', avatar);
          setTimeout(function() { usrdb.update({ avatar: avatar, title: title }); }, 10);
          $('#cloakroom').empty();
        });
      });

    });

    function cancelprofile() {
      $('#profile').off('click', 'img.close', cancelprofile).hide(300);
    }

    // Hall of Shame
    $('#others').click(function() {
      var table = '<img class="close" src="img/close_icon.gif" />'+
          '<table><tr><td><img src="img/eye.gif" /></td><td id="hos">Hall Of Shame</td></tr>';
      shame.sort(comptime);
      var now = new Date();
      $.each(shame, function(i, v) {
        var off = v.offline || v.online - 10;
        table += '<tr class="'+(v.online > off ? 'uonline' : 'uoffline') +'"><td>' + v.name + '</td><td>' +
            (v.online > off ? 'online '+deltaTime(now - v.online) : 'offline '+deltaTime(now - off)) +
            '</td></tr>';
      });
      $('#shame').show().on('click', 'img.close', cancelshame).html(table + '</table>');
    });

    function cancelshame() {
      $('#shame').off('click', 'img.close', cancelshame).hide(300);
    }

    function comptime(a, b) {
      var aon = a.online > a.offline;
      var bon = b.online > b.offline;
      if (aon && bon) {
        return b.online - a.online;
      }
      if (aon) { return -1; }
      if (bon) { return 1; }
      return b.offline - a.offline;
    }

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
    // console.log(messages.length);
  }

  function getParams(p) { // read from URL parameters or cookie
    var params = {}; // parameters
    p.replace(/[?&;]\s?([^=&;]+)=([^&;]*)/gi,
        function(m,key,value) { params[key] = value; });

    if (params.id) { id = params.id; }
    if (params.email) { email = params.email; }
    if (params.work) { work = params.work === 'true'; }
    if (params.avatar) { avatar = params.avatar; }
  }

  // functions for manipulating and formatting messages
  function insert(str) {  // insert str into message
    var el = $('#messageInput')[0];
    el.focus();
    if (el.setSelectionRange) { // not IE
      var ss = el.selectionStart;
      el.value = el.value.substring(0, ss) + str + el.value.substring(el.selectionEnd, el.value.length);
      el.selectionStart = el.selectionEnd = ss + str.length;
    } else {  // IE
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

  function temperature(unit) {  // insert temperatures into message
    var el = $('#messageInput')[0];
    el.focus();
    if (el.setSelectionRange) { // not IE
      var ss = el.selectionStart;
      var se = el.selectionEnd;
      var sel = el.value.substring(ss, se);
      var m = ((sel.length === 0) ? el.value.substring(0, ss) : sel).match(/-?[\d.]+$/);
      var str = (m === null || m.length !== 1) ? '&deg;'+unit : (unit === 'C' ?
          (sel.length !== 0 ? m[0] : '') + '&deg;C (' + (Math.round((+m[0] * 18.0) + 320.0) / 10.0) + '&deg;F)' :
          (sel.length !== 0 ? m[0] : '') + '&deg;F (' + (Math.round((+m[0] - 32.0) * (50.0 / 9.0)) / 10.0) + '&deg;C)');
      el.value = el.value.substring(0, ss) + str + el.value.substring(el.selectionEnd, el.value.length);
      el.selectionStart = el.selectionEnd = ss + str.length;
    } else {  // IE
      var iesel = document.selection.createRange().text;
      document.selection.createRange().text = iesel.length === 0 ? '&deg'+unit : (unit === 'C' ?
          iesel + '&deg;C (' + (Math.round((+iesel * 18.0) + 320.0) / 10.0) + '&deg;F)' :
          iesel + '&deg;F (' + (Math.round((+iesel - 32.0) * (50.0 / 9.0)) / 10.0) + '&deg;C)');
    }
  }

  var slimages = {
    'El0812.jpg': 'Ellen Hanrahan, El, Red',
    'Jen04.jpg': 'Jennifer K Longstaff, Jenn, jkl',
    'wm.jpg': 'Wm Leler',
    'wayne.gif': 'Wayne Hale, Zulu',
    'darroll.jpg': 'Darroll Evans, Buckwheat',
    'lorenboston.jpg': 'Loren Lacy',
    'julie.gif': 'Julie Hardin',
    'stilts.jpg': 'Dave Hill, Stiltskin',
    'kbh_2008.jpg': 'Kristen (Bendon) Hyman, Babe',
    'pippa.jpg': 'Pippa, Cyndy, dolliedish',
    'margarita.jpg': 'Margarita Remus, M',
    'leslie11.jpg': 'Leslie, GeecheeGirl'
  };

}(jQuery));