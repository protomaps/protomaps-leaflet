var ptsdef = "";
var currFile = "";

var demos = document.querySelectorAll(".demo");

for (var i=0; i<demos.length; i++) {
  var file = demos[i].getAttribute("data-src");
  demos[i].addEventListener("click", function() {
    var sel = this.getAttribute("data-src");
    if (sel.indexOf("https://") === 0) {
      window.open( sel, "pts_demo" );
    } else {
      window.location.href = window.location.origin+window.location.pathname+"?name="+sel;
    }
  }.bind( demos[i] ) );
}

document.getElementById('demo').onload = function(evt) {
  if (window.frames.length > 0) {
    loadEditor();
  }
}

document.getElementById("run").addEventListener("click", function(evt) {
  runCode();
});

document.getElementById("back").addEventListener("click", function(evt) {
  window.location.href = window.location.origin + "/demo/?name="+currFile;
});

document.getElementById("save").addEventListener("click", function(evt) {
  console.log("not yet implemented")
});

function _load( file, callback ) {
  var client = new XMLHttpRequest();
  client.open('GET', file);
  client.onload = callback;
  client.send();
}

function loadEditor() {
  vscode();
}

function runCode() {
  if (window.frames.length > 0) {
    frames[0].update( editor.getValue() );
  }
}


function loadCode( editor ) {
  currFile = "";
  var qfile = qs("name", 30);
  if (qfile) {
    _load( '../'+qfile+'.js', function(evt) {
      if ( (evt.target.statusText == "OK" || evt.target.statusText.length === 0) && evt.target.status < 400 ) {
        editor.setValue( evt.target.responseText );
        currFile = qfile;
        runCode();
      } else {
        editor.setValue( "// An error has occured while loading demo \n// File: "+qfile+" ("+ clean_str(evt.target.statusText, 20)+")" );
      }
    })
  }
}


function vscode() {
  window.editor = CodeMirror(document.getElementById("editor"),{lineNumbers:true,value:"",mode:'javascript',colorpicker:true})
  editor.setSize(null,"100%");
  document.getElementById("loader").style.display = "none";
  loadCode(window.editor);
}


function qs(name, limit) {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
      results = regex.exec(location.search);
  let q = (results === null) ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
  return clean_str( q, limit );
}

function clean_str( str, limit ) {
  if (limit) str = str.substr(0, limit);
  return str.replace( /[^a-zA-Z0-9._]/g, "_" );
}