/**
 * Created by Kris on 12-6-2015.
 */

var region = 'EU-London'; //server region to request

var http = require('http');
var AgarioClient = require('./agario-client.js'); //in your code you should do require('agario-client')

var client = new AgarioClient('worker'); //create new client and call it "worker" (not nickname)
var interval_id = 0; //here we will store setInterval's ID

client.connect("ws://127.0.0.1:9158/");

var hasTarget = false;
var target_x = -1;
var target_y = -1;

client.on('connected', function () { //when we connected to server
    client.log('spawning');
    client.spawn('[xFake]'); //spawning new ball
    interval_id = setInterval(recalculateTarget, 100); //we will search for target to eat every 100ms
});

function recalculateTarget() { //this is all our example logic
    var running = false;
    var run_x = [];
    var run_y = [];
    var bad_boys = [];
    // TODO add with orientation

    var candidate_ball = null; //first we don't have candidate to eat
    var candidate_distance = 0;
    var my_ball = client.balls[client.my_balls[0]]; //we get our first ball. We don't care if there more then one, its just example.
    if (!my_ball) return; //if our ball not spawned yet then we abort. We will come back here in 100ms later

    for (var ball_id in client.balls) { //we go true all balls we know about
        var ball = client.balls[ball_id];
        if (ball.virus) continue; //if ball is a virus (green non edible thing) then we skip it
        if (!ball.visible) continue; //if ball is not on our screen (field of view) then we skip it
        if (ball.mine) continue; //if ball is our ball - then we skip it

        /* Calculate evasiveness */
        var distance = getDistanceBetweenBalls(ball, my_ball); //we calculate distances between our ball and candidate
        if (ball.size / my_ball.size > 1.1) {
            if (distance < ball.size * 4) {
                run_x.push(my_ball.x - (ball.x - my_ball.x));
                run_y.push(my_ball.y - (ball.y - my_ball.y));
                running = true;
                console.log("running from: " + ball);
            }
            continue;
        } else if (ball.size / my_ball.size > 0.7) continue;

        if (candidate_ball && distance > candidate_distance) continue; //if we do have some candidate and distance to it smaller, than distance to this ball, we skip it

        candidate_ball = ball; //we found new candidate and we record him
        candidate_distance = getDistanceBetweenBalls(ball, my_ball); //we record distance to him to compare it with other balls

    }
    if (!candidate_ball) return; //if we didn't find any candidate, we abort. We will come back here in 100ms later

    if (running) {
        //client.log('running ' + enemy_ball + ', distance ' + enemy_distance);
        var x = average(run_x);
        var y = average(run_y);
        client.moveTo(x, y);
    } else {
        //client.log('closest ' + candidate_ball + ', distance ' + candidate_distance);
        client.moveTo(candidate_ball.x, candidate_ball.y); //we send move command to move to food's coordinates
    }
}

function getDistanceBetweenBalls(ball_1, ball_2) { //this calculates distance between 2 balls
    return Math.sqrt(Math.pow(ball_1.x - ball_2.x, 2) + Math.pow(ball_2.y - ball_1.y, 2));
}

function getDistanceToPoint(ball_1, x2, y2) { //this calculates distance between 2 balls
    return Math.sqrt(Math.pow(ball_1.x - x2, 2) + Math.pow(y2 - ball_1.y, 2));
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
        client.spawn("xFake");
    }, 2000);
});

function average(list) {
    var total = 0;
    for (i = 0; i < list.length; i++) {
        total += list[i];
    }
    return total / list.length;
}