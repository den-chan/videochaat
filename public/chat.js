var streamState = {}, PING_DROPOUT = 5, //seconds
    wsuri = "wss://inde.server:3000/";

// WebRTC polyfill
RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
RTCSessionDescription = window.RTCSessionDescription || window.webkitRTCSessionDescription || window.mozRTCSessionDescription;

// getUserMedia polyfill
window.MediaStream = window.MediaStream || window.webkitMediaStream;
var polyGUM = function(constraints) {
  var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
  if (!getUserMedia) return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
  return new Promise(function(resolve, reject) { getUserMedia.call(navigator, constraints, resolve, reject) })
}
if(navigator.mediaDevices === undefined) navigator.mediaDevices = {};
if(navigator.mediaDevices.getUserMedia === undefined) navigator.mediaDevices.getUserMedia = polyGUM;





//Functions
//  Utilities
//    $ enhances querySelectorAll
function $(sel, node, a) { return (a = [].slice.call( (node || document).querySelectorAll(sel) )).length > 1 ? a : a[0] }

//    addEvents enhances addEventListener
function addEvents(obj) {
  function add(n) { n.addEventListener(es[i], obj[q][e].bind(n), false) }
  for (var q in obj) for (var e in obj[q]) {
    var ns = q ? $(q) : [window, document], es = e.split(" "), el = es.length, i = 0;
    for (; i < el; i++) typeof ns === "undefined" ? 0 : ns.constructor.name === "Array" ? ns.forEach(add) : add(ns)
  }
}

//  Connect websocket to exchange webRTC SDPs
function ws(uri) {
  return new Promise(function (resolve, reject) {
    var ws = streamState.ws = new WebSocket(uri);
    ws.onmessage = function(m) {
      var data = JSON.parse(m.data);
      if (data.type === "connect") resolve(streamState.id = data.id);
      else if (data.type === "register") {
        $("#room").classList.remove("hide");
        $("#prompt").classList.add("hide");
        streamState.call_id = data.id;
        getMedia().then(rtc)
      }
      else if (data.type === "error" && data.code === "1") {
        requestAnimationFrame(function() {
          $("#flash").classList.remove("off");
          requestAnimationFrame(function() {
            $("#flash").classList.add("off");
          })
        });
        $("#flashMsg").textContent = "Passphrase failed"
      }
      else if (data.sessionDescription.type === "offer") rtc(data.sessionDescription).catch(handle_errors);
      else if (data.sessionDescription.type === "answer") {
        streamState.conn.pc.setRemoteDescription(new RTCSessionDescription(data.sessionDescription))
      }
    };
    ws.error = reject
  })
}

//  Offer/answer webRTC with video + audio stream & chat on a data channel
function getMedia() {
  return navigator.mediaDevices.getUserMedia({video: true, audio: true}).then(function(s) {
    $("#local").src = window.URL.createObjectURL(streamState.localmedia = s);
  })
}
function rtc (odesc) {
  pc = new RTCPeerConnection(/*servers*/
    {"iceServers": [{ "urls": "stun:stun.l.google.com:19302" }]},
    { optional: [{ "RtpDataChannels": false }] }
  );
  streamState.conn = { pc: pc, dc: null, ping: { id: null, limit: PING_DROPOUT, dropped: 0 } };
  pc.addStream(streamState.localmedia);
  pc.onicecandidate = function (e) { if (e.candidate === null) {
    streamState.ws.send( JSON.stringify({ id: streamState.call_id, sessionDescription: pc.localDescription }) )
  } };
  if ("ontrack" in pc) pc.ontrack = function (e) { $("#remote").src = window.URL.createObjectURL(e.streams[0]) };
  else if ("onaddstream" in pc) pc.onaddstream = function (e) { $("#remote").src = window.URL.createObjectURL(e.stream) };
  if (odesc) {
    pc.ondatachannel = function (e) { dc_start(streamState.dc = e.channel || e) };
    return new Promise(function (resolve, reject) {
      pc.setRemoteDescription(new RTCSessionDescription(odesc), function () {
        pc.createAnswer( function (adesc) {
          pc.setLocalDescription(adesc, resolve, reject)
        }, reject)
      }, reject)
    })
  } else {
    dc_start(streamState.dc = pc.createDataChannel('webcam', {reliable: true}));
    return new Promise(function (resolve, reject) {
      pc.createOffer(function (desc) {
        pc.setLocalDescription(desc, resolve, reject)
      }, reject)
    })
  }
}

function dc_start(dc) {
  dc.onopen = function () { streamState.ws.close() };
  dc.onmessage = function (e) { write(e.data, "remote") };
  dc.onclose = function () {};
}

//  HTML escape utility
function escape (text) {
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(text));
  return div.innerHTML
}

//  Display chat message
function write (data, source) {
  var a = document.createElement("p");
  a.className = source + "msg";
  a.innerHTML = escape(data);
  display.appendChild(a);
  display.scrollTop = display.scrollHeight
}

//Event listeners
addEvents({
  "#chatField": {
    keyup: function (e) {
      if (e.which === 13) {
        write(this.value, "local");
        streamState.dc.send(this.value);
        this.value = ""
      }
    }
  },
  "#createButton": {
    click: function (e) {
      $("#room").classList.remove("hide");
      $("#prompt").classList.add("hide");
      ws(wsuri).then(function (id) {
        streamState.ws.send(JSON.stringify({type: "register", id: id, plaintext: $("#createPass").value}));
        return getMedia().then(rtc)
      }).catch(handle_errors)
    }
  },
  "#entryButton": {
    click: function (e) {
      ws(wsuri).then(function () {
        streamState.ws.send(JSON.stringify({type: "passphrase", plaintext: $("#entryPass").value}));
      })
    }
  }
})

// Error handling
function handle_errors(e) {
  console.log(e.name + ": " + e.message)
}
