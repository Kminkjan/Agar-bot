/**
 * Created by Kris on 12-6-2015.
 */

var region = 'EU-London'; //server region to request

var http = require('http');
var AgarioClient = require('./agario-client.js'); //in your code you should do require('agario-client')
//var Repeater = require('./repeater.js'); //in your code you should do require('agario-client')

var client = new AgarioClient('worker'); //create new client and call it "worker" (not nickname)
//var repeater = new  Repeater();

var interval_id = 0; //here we will store setInterval's ID
var repeaterOn = false;

var canvas = null;
var WebSocketServer = require('ws').Server
    , wss = new WebSocketServer({port: 8000});
wss.on('connection', function(ws) {
    canvas = ws;
    console.log("connected, ");
    ws.on('message', function(message) {
        console.log('received: %s', message);
    });
    ws.send("0,0");
    start();
});

client.connect("ws://127.0.0.1:9158/");

client.on('connected', function () { //when we connected to server
    start();
});

function start() {
    client.log('spawning');
    client.spawn('[xFake]'); //spawning new ball
    interval_id = setInterval(update, 100);
}

function update() { // TODO check amount of times i've split
    // TODO dont run in to another cell when fleeing for a big on
    // TODO or just ignore really big ones for now
    //console.time('update');
    var my_ball = client.balls[client.my_balls[0]];
    if (!my_ball) return;

    /* Sort balls */
    var threats = [], targets = [], virusses = [], foods = [];
    for (var ball_id in client.balls) { //we go true all balls we know about
        var ball = client.balls[ball_id];
        if (!ball.visible || ball.mine) continue;

        if (ball.virus) {
            virusses.push(ball);
            continue;
        }
        if (ball.name == null && ball.size < 30) { // Safety
            foods.push(ball);
            continue;
        }
        var relativeSize = ball.size / my_ball.size;
        if (relativeSize > 1.1) { // I can be eaten
            threats.push(ball);
        } else if (relativeSize < 0.7) {
            targets.push(ball);
        }
    }

    /* Save all coordinates to run to */
    var run_x = [];
    var run_y = [];

    /* Save the unsafe directions */
    var bad_directions = [];

    /* Process threats */
    for (var threat_id in threats) {
        var threat = threats[threat_id];
        bad_directions.push(directionTo(my_ball, threat));
        var distance = getDistanceBetweenBalls(threat, my_ball);
        if ((ball.size / my_ball.size > 4 && distance < threat.size * 2.5) || distance < threat.size) {
            run_x.push(my_ball.x - (threat.x - my_ball.x));
            run_y.push(my_ball.y - (threat.y - my_ball.y));
            console.log("running from: " + threat + threat.size + ", direction: " + directionTo(my_ball, threat));
        }
    }

    /* Process virusses */
    for (var virus_id in virusses) {
        var virus = virusses[virus_id];
        if (getDistanceBetweenBalls(my_ball, virus) < my_ball.size) {
            run_x.push(my_ball.x - (virus.x - my_ball.x));
            run_y.push(my_ball.y - (virus.y - my_ball.y));
            console.log("running from: " + virus);
        }
    }

    var potential_target = null;
    var distance_target = 0;

    /* Process potential targets */
    for (var target_id in targets) {
        var target = targets[target_id];
        distance = getDistanceBetweenBalls(my_ball, target);
        if ((distance < my_ball.size * 3 && potential_target == null) || distance < distance_target) {
            potential_target = target;
            distance_target = distance;
        }
    }

    /* Do calculated action */
    if (run_x.length != 0) { // Running from something TODO corner and edge detection
        /* Calculate the average point to run away to and go there */
        client.moveTo(average(run_x), average(run_y));
    } else if (potential_target) {
        client.moveTo(potential_target.x, potential_target.y);
        var split_threshold = my_ball.size * 4;
        relativeSize = potential_target.size / my_ball.size;
        console.log("targetting: " + potential_target.name
                + ", distance: " + distance_target
                + ", threshold: " + split_threshold
                + ", relative size: " + relativeSize
                + ", balls left: " + client.my_balls.length);
        if (distance_target < split_threshold && 0.1 > relativeSize < 0.45 && client.my_balls.length < 2) { // TODO no biggies in the hood
            client.split();
        }
    } else {
        // Calculate right direction
        var willpower = calculateDirection(my_ball.x, my_ball.y, 10000, 10000);

        // TODO Favor going to the center of the map; edges are scary!
        // TODO Find pockets of food

        /* Process foods */
        potential_target = null;
        for (var food_id in foods) {
            var food = foods[food_id];
            distance = getDistanceBetweenBalls(my_ball, food);
            if (safeDirection(bad_directions, directionTo(my_ball, food)) && (potential_target == null || distance < distance_target)) {
                potential_target = food;
                distance_target = distance;
            }
        }
        if (potential_target != null) {
            //if (canvas) {
            //    //canvas.send(potential_target.x + ", " + potential_target.y);
            //    canvas.send(JSON.stringify([potential_target.x, potential_target.y]));
            //}
            client.moveTo(potential_target.x, potential_target.y);
        } else {
            client.moveTo(10000, 10000);
        }
    }
    //console.timeEnd('update');
}

/* #################### HELPER METHODS ####################### */

function getDistanceBetweenBalls(ball_1, ball_2) { //this calculates distance between 2 balls
    return Math.sqrt(Math.pow(ball_1.x - ball_2.x, 2) + Math.pow(ball_2.y - ball_1.y, 2));
}

function directionTo(ball1, ball2) {
    return calculateDirection(ball1.x, ball1.y, ball2.x, ball2.y);
}

function calculateDirection(x1, y1, x2, y2) {
    var theta = Math.atan2(y2 - y1, x2 - x1);
    if (theta < 0) theta += 2 * Math.PI;
    return theta * 180 / Math.PI;
}

/**
 * This function checks if the given direction is a safe direction to go to. This is done by checking if the direction
 * is too close near a BAD DIRECTION. In this case the method instantly returns false.The detection range is 160
 * degrees when there is one unsafe direction and 90 degrees otherwise..
 * @param list  List of unsafe directions
 * @param direction direction that will be checked
 * @returns {boolean}   true if safe
 */
function safeDirection(list, direction) {
    var range = list.length == 1 ? 80 : 45;
    for (var index in list) {
        var degrees = list[index];
        if (Math.abs(degrees - direction) < range || Math.abs(degrees - direction + 360) < range) return false;
    }
    return true;
}

/**
 * Calulates the average of all the items in a list. Used to calculate the average of multiple points, when the bot
 * wants to flee from threats.
 * @param list  The items
 * @returns {number}    Average of the items
 */
function average(list) {
    var total = 0;
    for (var i = 0; i < list.length; i++) {
        total += list[i];
    }
    return total / list.length;
}

/* ################### EVENT FUNCTIONS ################# */

client.on('mineBallDestroy', function (ball_id, reason) { //when my ball destroyed
    if (reason.by) {
        console.log(client.balls[reason.by] + ' ate my ball');
    }
    console.log('i lost my ball ' + ball_id + ', ' + client.my_balls.length + ' balls left');
    if(client.my_balls.length == 0) {
        setTimeout(function () {
            client.spawn("[xFake]Fieldhof");
        }, 2000);
    }
});


    /*
client.on('lostMyBalls', function () { //when i lost all my balls
    client.log('destroy spawning');
    setTimeout(function () {
        client.spawn("[xFake]");
    }, 2000);
});
*/

