var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 5000;

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

var current_word = "zebra";
var revealed_length = 1;
var current_question = "";
var current_answer = "";
var current_questioner = "";
var contacts = [];
var leaderBoard = [];
var lockState = "";
var currentThinker = 0;
var gameStarted = false;

function logState() {
	console.log("========================");
	console.log("Word = " + current_word);
	console.log("Revealed = " + current_word.substring(0,revealed_length) + " , length : ", revealed_length);
	console.log("Questioner = " + current_questioner);
	console.log("Question = " + current_question);
	console.log("Answer = " + current_answer);
	console.log("LockState = " + lockState);
    console.log("currentThinker = " + currentThinker);
	console.log("Contacts = " + contacts);
	console.log("leaderBoard = " + leaderBoard);
}

io.on('connection', function(socket){
  //Handle Add User
  socket.on('add user', function(user){
  	var existing = false;
  	for(var i=0;i<leaderBoard.length;i++) {
  		if(leaderBoard[i][0] === user) {
  			existing = true;
  			break;
  		}
  	}
    if(user == "none" || existing == true) {
      socket.emit('chat message', "add user failed" + user);
      socket.emit('login failed');
    } else {
  	  leaderBoard.push([user,0]);
      io.emit('chat message', "add user" + user);
      socket.emit('login successful', gameStarted);
      io.emit("refresh data", leaderBoard);
    }
    logState();
  });

  socket.on('start', function(){
    if(leaderBoard.length == 0) {
      io.emit('chat message', "game start failed");
      io.emit('game start failed');
    } else if(currentThinker >= leaderBoard.length){
        currentThinker = currentThinker % leaderBoard.length;
        io.emit('chat message', "Round End");
        io.emit('Round End');
    } else {
      io.emit('chat message', "currentThinker " + currentThinker + leaderBoard[currentThinker][0]);
      currentThinker++;
      gameStarted = true;
      io.emit('game started', leaderBoard[currentThinker - 1][0]);
    }
    logState();
  });
  //Handle Add Word
  socket.on('add word', function(user, word){
  	current_word = word;
    io.emit('chat message', "add word by " + user);
    socket.emit('chat message', "add word by " + user + " " + word);
    io.emit('enable question');
    io.emit('reveal word',current_word.substring(0,revealed_length));
    logState();
  });
  //Handle Lock
  socket.on('lock question', function(user){
    if(lockState == "") {
    	lockState = user;
      io.emit('chat message', "locked by " + user);
      socket.emit('ask question');
      io.emit('disable question');
     } else {
    	io.emit('chat message', "Already locked by " + lockState);
    }
    logState();
  });
  //Handle Unlock
  socket.on('unlock question', function(user){
    
    if(lockState == user) {
		io.emit('chat message', "unlocked by " + user);
		lockState = "";
		current_question = "";
    current_answer = "";
    io.emit('enable question');
    } else {
		io.emit('chat message', "Unlock Failed. Not locked by " + user);
    }
    logState();
  });
  //Handle QA
  socket.on('handle qa', function(user, question, ans){
  	var revealed = current_word.substring(0,revealed_length);
  	if(lockState != user) {
  		io.emit('chat message', "add qa failed, not locked by " + user);
  	}
  	else if(current_question != "") {
  		io.emit('chat message', "add qa failed, question already exists " + current_question);
  	} else if(ans.startsWith(revealed) == false) {
  		socket.emit('chat message', "add qa failed, answer doesn't start with revealed word" + ans + "("+ revealed + ")");
  	} else {
	  	current_question = question;
	  	current_answer = ans;
	  	current_questioner = user;
	  	contacts = [];
	    io.emit('chat message', "added question by " + user + " " + question);
      socket.emit('chat message', "added question " + question + " " + ans);
      io.emit('question added', user, current_question);
    }
    logState();
  });
  //Handle Contact
  socket.on('handle contact', function(user, ans){
    if(lockState == user) {
      io.emit('chat message', "contact failed, question asked by self");
      console.log(contacts);
    }
    else if(user == leaderBoard[currentThinker - 1][0]) {
      io.emit('chat message', "contact failed, thinker is self");
      console.log(contacts);
    }
    else {
      var amend = false;
      for(var i=0;i<contacts.length;i++) {
      	if(contacts[i][0] === user) {
      		contacts[i][1] = ans;
      		amend = true;
      		break;
      	}
      }
      if(amend == false) {
      	contacts.push([user, ans]);
      }
      io.emit('chat message', "contact by " + user);
      socket.emit('chat message', "contact by " + user + " " + ans);
    }
    console.log(contacts);
    logState();
  });
  socket.on('handle answer', function(user, ans){
    console.log("119");
    if(user != leaderBoard[currentThinker - 1][0]) {
      io.emit('chat message', "answer failed, not thinker" + user);
    }
    else {
      console.log("124" + contacts.length);
      var valid_contacts = 0;
      var res = "Canceled";
      for(var i=0; i<contacts.length; i++) {
        console.log(contacts[i][1] + current_answer);
        if(contacts[i][1] == current_answer) {
          valid_contacts++;
          var j = -1;
          for(j = 0; j < leaderBoard.length; j++) {
          	if(leaderBoard[j][0] === contacts[i][0]) {
          		leaderBoard[j][1] += 10;
          		break;
          	}
          }
        }
      }
      console.log("134");
      if(ans == current_answer) {
        res = "Passed";
        leaderBoard[currentThinker - 1][1] += 10;
      } else if(valid_contacts > 0) {
        res = "Failed";
        revealed_length ++;
        var j = -1;
		for(j = 0; j < leaderBoard.length; j++) {
			if(leaderBoard[j][0] === current_questioner) {
				leaderBoard[j][1] += 10*valid_contacts;
				break;
			}
		}
        if(revealed_length >= current_word.length) {
          io.emit('chat message', "round ended, word is " + current_word);
        }
      }
      lockState = "";
      io.emit('chat message', res + current_word.substring(0,revealed_length));
      io.emit('enable question');
      io.emit('update score', leaderBoard);
      io.emit('reveal word',current_word.substring(0,revealed_length));
  } 
  console.log("147");
  for(var i=0; i<contacts.length; i++)
    contacts[i].splice(0);
  contacts.splice(0);
  current_question = "";
	logState();
  });
});

http.listen(port, function(){
  console.log('listening on *:' + port);
});