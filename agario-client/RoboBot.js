/**
 * Created by Kris on 12-6-2015.
 */

var region = 'EU-London'; //server region to request

var http = require('http');
var AgarioClient = require('./agario-client.js'); //in your code you should do require('agario-client')

var client = new AgarioClient('worker'); //create new client and call it "worker" (not nickname)
var interval_id = 0; //here we will store setInterval's ID

client.connect("ws://127.0.0.1:9158/");

client.on('connected', function () { //when we connected to server
    client.log('spawning');
    client.spawn('[xFake]'); //spawning new ball
    interval_id = setInterval(update, 100);
});

function update() {
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
        if (ball.size < 15) {
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
        if (distance < threat.size * 3) {
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
        if ((distance < my_ball.size * 2 && potential_target == null) || distance < distance_target) {
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
        if (distance_target < my_ball.size) { // TODO smart splitting
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
            client.moveTo(potential_target.x, potential_target.y);
        }
    }
}

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
 * is too close near a BAD DIRECTION. In this case the method instantly returns false.The detection range is
 * 160 degrees.
 * @param list  List of unsafe directions
 * @param direction direction that will be checked
 * @returns {boolean}   true if safe
 */
function safeDirection(list, direction) {
    for (var index in list) {
        var degrees = list[index];
        if (Math.abs(degrees - direction) < 80 || Math.abs(degrees - direction + 360) < 80) return false;
    }
    return true;
}

client.on('mineBallDestroy', function (ball_id, reason) { //when my ball destroyed
    if (reason.by) {
        console.log(client.balls[reason.by] + ' ate my ball');
    }
    console.log('i lost my ball ' + ball_id + ', ' + client.my_balls.length + ' balls left');
});

client.on('lostMyBalls', function () { //when i lost all my balls
    client.log('destroy spawning');
    setTimeout(function () {
        client.spawn("[xFake]");
    }, 2000);
});

function average(list) {
    var total = 0;
    for (var i = 0; i < list.length; i++) {
        total += list[i];
    }
    return total / list.length;
}