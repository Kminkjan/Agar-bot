/**
 * Created by Kris on 12-6-2015.
 */

var region = 'EU-London'; //server region to request

var http = require('http');
var AgarioClient = require('./agario-client.js'); //in your code you should do require('agario-client')

var client = new AgarioClient('worker'); //create new client and call it "worker" (not nickname)
var interval_id = 0; //here we will store setInterval's ID

var center_x = 10000;
var center_y = 10000;
var orientationToCenter = 0;

client.connect("ws://127.0.0.1:9158/");

client.on('connected', function () { //when we connected to server
    client.log('spawning');
    client.spawn('[xFake]'); //spawning new ball
    //interval_id = setInterval(recalculateTarget, 100); //we will search for target to eat every 100ms
    interval_id = setInterval(update, 100);
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
            if (distance < ball.size * 3) {
                run_x.push(my_ball.x - (ball.x - my_ball.x));
                run_y.push(my_ball.y - (ball.y - my_ball.y));
                running = true;
                console.log("running from: " + ball);
            }
            continue;
        } else if (ball.size / my_ball.size > 0.7) continue; // No threat

        if (candidate_ball && distance > candidate_distance) continue; //if we do have some candidate and distance to it smaller, than distance to this ball, we skip it
        candidate_ball = ball; //we found new candidate and we record him
        candidate_distance = getDistanceBetweenBalls(ball, my_ball); //we record distance to him to compare it with other balls
    }
    if (!candidate_ball) return; //if we didn't find any candidate, we abort. We will come back here in 100ms later

    if (running) {
        var x = average(run_x);
        var y = average(run_y);
        client.moveTo(x, y);
    } else {
        client.moveTo(candidate_ball.x, candidate_ball.y); //we send move command to move to food's coordinates
    }
}

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

        if(ball.size < 15) {
            foods.push(ball);
            continue;
        }

        var relativeSize = ball.size / my_ball.size;
        if (relativeSize > 1.1) {
            threats.push(ball);
        } else if (relativeSize < 0.7) {
            targets.push(ball);
        }
    }

    var run_x = [];
    var run_y = [];
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
        if ((distance < my_ball.size*2 && potential_target == null) || distance < distance_target) {
            potential_target = target;
            distance_target = distance;
        }
    }

    /* Do calculated action */
    if (run_x.length != 0) { // Running from something
        client.moveTo(average(run_x), average(run_y));
    } else if (potential_target)  {
        console.log("Targeting: " + potential_target + ", direction: " + directionTo(my_ball, potential_target));
        client.moveTo(potential_target.x, potential_target.y);
        if (distance_target < my_ball.size) {
            client.split();
        }
    } else {
        // Calculate right direction
        var willpower = calculateDirection(my_ball.x, my_ball.y, 10000, 10000);


        // TODO Find closest food in that average direction
        // TODO Find pockets of food
        // TODO look up general directions of threats and just dont go there

        /* Process foods */
        potential_target = null;
        for (var food_id in foods) {
            var food = foods[food_id];
            distance = getDistanceBetweenBalls(my_ball, food);
            if (validFood(bad_directions, directionTo(my_ball, food)) && (potential_target == null || distance < distance_target)) {
                potential_target = food;
                distance_target = distance;
            }
        }

        if (potential_target != null) {
            console.log("Eating: " + potential_target + ", direction: " + directionTo(my_ball, potential_target));
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

function validFood(list, direction) {
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
    for (i = 0; i < list.length; i++) {
        total += list[i];
    }
    return total / list.length;
}