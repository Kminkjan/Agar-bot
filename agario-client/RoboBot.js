/**
 * Created by Kris on 12-6-2015.
 */

var region = 'EU-London'; //server region to request

var http = require('http');
var AgarioClient = require('./agario-client.js'); //in your code you should do require('agario-client')

var client = new AgarioClient('worker'); //create new client and call it "worker" (not nickname)
var interval_id = 0; //here we will store setInterval's ID

client.connect("ws://127.0.0.1:9158/");