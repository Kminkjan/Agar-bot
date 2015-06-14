// ==UserScript==
// @name        RoboBot
// @namespace   RoboBot
// @include     http://agar.io/
// @version     3.04
// @require http://code.jquery.com/jquery-latest.js
// @grant       none
// @author      Kris Minkjan
// ==/UserScript==

$(function(){
    connect("ws://127.0.0.1:415/");
    var canvas = $("#canvas");
    var ctx = canvas[0].getContext('2d');

    var socket= new WebSocket('ws://127.0.0.1:8000/');
    socket.onopen= function() {
        socket.send('hello');
    };
    socket.onmessage= function(s) {
        console.log(s);
        //var a = JSON.parse(s.data);
        //console.log(a[0] + " : "+ a[1]);
        //ctx.strokeStyle = "#df4b26";
        //ctx.fillStyle = "#FF0000";
        //ctx.lineJoin = "round";
        //ctx.lineWidth = 5;
        //ctx.fillRect(a[0],a[1],150,75);
        //ctx.fillRect(10,10,150,75);
    };
});