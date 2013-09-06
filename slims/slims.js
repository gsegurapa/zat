// Jack Rabbit Slims chat room

(function($) {
	"use strict";

  var id;

  getParams('?'+document.cookie); // params from cookies
  getParams(window.location.href); // params from URL override

  if (id === undefined) {
    var t = prompt('Enter your id');
    if (t.length > 0) {
      id = t;
      setCookie('id', id);
    }
  }
  console.log(id, id.length, typeof id);

  var firebasedb = new Firebase('https://jrslims.firebaseIO.com/');

  firebasedb.on('child_added', function(snapshot) {
    var message = snapshot.val();
    var d = new Date(message.stamp);
    var now = new Date();
    // $('<div/>').text(message.text).prepend($('<strong/>').html('<hr />'+message.name+' '+deltaTime(new Date()-d)+' ago<br/>')).prependTo($('#messagesDiv'));
    $('<div/>').append('<hr/>').
      append($('<strong/>').text(message.name)).
      append($('<span/>', {'class': 'mtime'}).data('mts', d)).
      append($('<div/>').text(message.text)).
      prependTo($('#messagesDiv')).
      css('background-color', '#ffc').
      animate({'background-color': '#fff'}, 10000);
      $('.mtime').each(function() {
        var el = $(this);
        el.text(' - '+deltaTime(now-el.data('mts'))+' ago');
      });
  });

  $(document).ready(function() {
    $('#nameInput').text(id);
  	$('#kibbitz').click( function(e) {
      var name = $('#nameInput').text();
      var mess = $('#messageInput').val();
      if (name.length === 0 || mess.length === 0) { return; }
      firebasedb.push({
        name: name,
        text: mess,
        stamp: Firebase.ServerValue.TIMESTAMP
      });
      $('#messageInput').val('');
    });

    // setInterval(function() {  // update times
    //   var now = new Date();
    //   $('.mtime').each(function() {
    //     var el = $(this);
    //     el.text(' - '+deltaTime(now-el.data('mts'))+' ago');
    //   });
    // }, 1000);

  });

  function pl(v) { // plural
    return ((v != 1) ? 's' : '');
  }

  function deltaTime(d) {
    d /= 1000;
    if (d<0) { d = -d; }
    var year = Math.floor(d/31536000);
    var week = Math.floor((d%31536000)/604800);
    if (1<=year) { return year+" year"+pl(year)+" "+week+" week"+pl(week); }
    var weekday = Math.floor((d%604800)/86400);
    var day = Math.floor(d/86400);
    if (30<day) { return week+" week"+pl(week)+" "+weekday+" day"+pl(weekday); }
    var hour = Math.floor((d%86400)/3600);
    if (1<=day) { return day+" day"+pl(day)+" "+hour+" hour"+pl(hour); }
    var minute = Math.floor((d%3600)/60);
    if (1<=hour) { return hour+" hour"+pl(hour)+" "+minute+" minute"+pl(minute); }
    var second = Math.floor(d%60);
    if (1<=minute) { return minute+" minute"+pl(minute)+" "+second+" second"+pl(second); }
    var tenth = Math.floor((d%1)*10);
    var hund = Math.floor(((d*10)%1)*10);
    return second+((second<10)?("."+tenth+(second==0?hund:"")):"")+" seconds";
  }

  function getParams(p) {
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


}(jQuery));