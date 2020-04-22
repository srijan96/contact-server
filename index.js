var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http, {
  transports: ['websocket'],
  allowUpgrades: false,
  pingInterval: 25000,
  pingTimeout: 60000
});

var port = process.env.PORT || 5000;

const levenshtein = require('js-levenshtein');

app.get('/', function(req, res){
  res.sendFile(__dirname + '/index.html');
});

var current_word = "";
var revealed_length = 1;
var current_question = "";
var current_answer = "";    // Answer set by question setter
var thinker_answer = "";    // Answer given by thinker
var current_questioner = "";
var contacts = [];
var leaderBoard = [];
var current_players = [];   // list of active players
var passed_users = [];      // list of users who have passed the current question
var lockState = "";
var currentThinker = 0;
var gameStarted = false;
var questionTimeout = 0     // questionTimeout Variable 
var hasThinkerAnswered = 0; // boolean to keep track if thinker has answered or not

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
  console.log("current_players = " + current_players);
}

io.on('connection', function(socket){
  socket.on('disconnect', function(reason) {
    console.log(socket.id + " disconnected due to: " + reason);
    for(var i=0;i<leaderBoard.length;i++) {
      if(leaderBoard[i][2] === socket.id) {
        if(i == currentThinker - 1) {
          io.emit("chat message", leaderBoard[i][0] + "(current thinker) left the game. ");
          gameStarted = false;
          revealed_length = 1;
          var leaving_user = leaderBoard[i][0];
          current_players.splice(current_players.indexOf(leaving_user), 1);
          io.emit('round end');
        } else if(leaderBoard[i][0] === lockState) {
          io.emit("chat message", leaderBoard[i][0] + "(current questioner) left the game");
          lockState = "";
          current_question = "";
          current_answer = "";
          var leaving_user = leaderBoard[i][0];
          current_players.splice(current_players.indexOf(leaving_user), 1);
          io.emit('enable question');
        } else {
          var leaving_user = leaderBoard[i][0];
          current_players.splice(current_players.indexOf(leaving_user), 1);
          io.emit("chat message", leaderBoard[i][0] + " left the game");
        }

        if (current_players.length == 0) {
          io.emit('game end');
          current_word = "";
          revealed_length = 1;
          current_question = "";
          current_answer = "";
          current_questioner = "";
          contacts = [];
          leaderBoard = [];
          lockState = "";
          currentThinker = 0;
          gameStarted = false;
          break;
        }

        leaderBoard[i][2] = "";
        io.emit("refresh data", leaderBoard);
        break;
      }
    }
    logState();
  });
  //Handle Add User
  socket.on('add user', function(user){
  	console.log("Adding user from socket : " + socket.id);
    
    var existing = -1;
    for(var i=0;i<leaderBoard.length;i++) {
        if(leaderBoard[i][0] === user) {
            existing = i;
            break;
        }
    }

    if(user == "") {
      socket.emit('chat message', "add user failed" + user);
      socket.emit('login failed');
    } else {
      if(existing != -1) {
        if(leaderBoard[existing][2] != "") {
          socket.emit('login failed');
        } else {
          leaderBoard[existing][2] = socket.id;
          current_players.push(user);
          io.emit('chat message', user + "joined back");
          socket.emit('login successful', gameStarted, lockState, current_question, current_word.substring(0,revealed_length));
          socket.emit('reveal word',current_word.substring(0,revealed_length), current_word.length-revealed_length);
          io.emit("refresh data", leaderBoard);
        }
      } else {
        leaderBoard.push([user,0,socket.id]);
        current_players.push(user);
        io.emit('chat message', user + "joined the game");
        socket.emit('login successful', gameStarted, lockState, current_question, current_word.substring(0,revealed_length));
        socket.emit('reveal word',current_word.substring(0,revealed_length), current_word.length-revealed_length);
        io.emit("refresh data", leaderBoard);
      }
    }
    logState();
  });
  
  socket.on('start', function(){
    if(gameStarted == true) {
      	socket.emit('chat message', "Game has already started");
    } else if(leaderBoard.length == 0){
	socket.emit('chat message', "game start failed");
      	io.emit('game start failed');
    } else if(currentThinker >= leaderBoard.length){
        currentThinker = currentThinker % leaderBoard.length;
        io.emit('chat message', "End of Game");
        io.emit('game end');
        current_word = "";
        revealed_length = 1;
        current_question = "";
        current_answer = "";
        current_questioner = "";
        contacts = [];
        leaderBoard = [];
        lockState = "";
        currentThinker = 0;
        gameStarted = false;
    } else {
        while(currentThinker < leaderBoard.length && leaderBoard[currentThinker][2] === "")
      	currentThinker++;
	io.emit('chat message', leaderBoard[currentThinker][0] + " is thinking of a word. Hang back.");
	currentThinker++;
	gameStarted = true;
	io.emit('game started', leaderBoard[currentThinker - 1][0]);
	current_word = "";
	revealed_length = 1;
	current_question = "";
	current_answer = "";
	current_questioner = "";
	contacts = [];
	lockState = "";
    }
    logState();
  });

  //Handle Add Word
  socket.on('add word', function(user, word){
    word = word.toLowerCase();
  	current_word = word;
    io.emit('chat message', user + " has added a word. You may ask a question whose ans starts with " + word[0]);
    socket.emit('chat message', "add word by " + user + " " + word);
    io.emit('enable question');
    io.emit('reveal word',current_word.substring(0,revealed_length), current_word.length-revealed_length);
    logState();
  });

  //Handle Lock
  socket.on('lock question', function(user){
    if(lockState == "") {
    	lockState = user;
      io.emit('chat message', user + " is currently asking a question. Wait for them to finish");
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
		  io.emit('chat message', "Current question by" + user + " has concluded");
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
    ans = ans.toLowerCase();
  	var revealed = current_word.substring(0,revealed_length);
  	if(lockState != user) {
  		io.emit('chat message', "add qa failed, not locked by " + user);
  	}
  	else if(current_question != "") {
  		io.emit('chat message', "add qa failed, question already exists " + current_question);
  	} else if(ans.startsWith(revealed) == false) {
  		socket.emit('chat message', "Please check. Your question's answer doesn't start with revealed word" + ans + "("+ revealed + ")");
  	} else {
	  	current_question = question;
	  	current_answer = ans;
      current_answer = current_answer.toLowerCase();
      current_answer = current_answer.trim();
	  	current_questioner = user;
	  	contacts = [];
      passed_users = [];
	    io.emit('chat message', user + " has added a new question");
      socket.emit('chat message', "added question: " + question + ", answer: " + ans);
      io.emit('question added', user, current_question);
      
      // Wait 90 secs to give everyone time and then evaluate score 
      questionTimeout =  setTimeout(evaluate_score, 90000);
    }
    logState();
  });
  
  //HANDLE CONTACT
  socket.on('handle contact', function(user, ans){
    ans = ans.toLowerCase();
    ans = ans.trim();
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
      io.emit('chat message', user + " has initiated a contact");
      socket.emit('chat message', "contact has been placed by you with answer as "  + ans + ". You may change your contact until the thinker answers.");
      
      //Check if all have given an input or not to end the question
      end_ques_on_all_input();
    }

    console.log(contacts);
    logState();
  });

  //HANDLE PASS
  socket.on('handle pass', function(user) {
    //add user to the list of players who have passed the current question
    if (passed_users.indexOf(user) === -1) {
      passed_users.push(user);
      io.emit('chat message', user + " has passed the question");
      
      //Check if all have given an input or not to end the question
      end_ques_on_all_input();
    }
  });

  //ON THINKER ANSWER 
  socket.on('handle answer', function(user, ans){
    
    ans = ans.toLowerCase();
    ans = ans.trim();
    
    // Set thinker answer 
    thinker_answer = ans;

    //Setting boolean to 1 ie thinker has answered
    hasThinkerAnswered = 1;

    //Check if all have given input or not to end question
    end_ques_on_all_input();
  });

  // Checks if everybody has passed or contacted and thinker has answered to end the 90s timer
  function end_ques_on_all_input(){

    console.log("Contacts:" +contacts.length +"Passed:" + passed_users.length);
      
    if (contacts.length + passed_users.length + hasThinkerAnswered +1 == current_players.length){
        clearTimeout(questionTimeout);

        //timer stopped, now evaluate score needs to be called to start next question
        evaluate_score();
      }
  }

  //EVALUATE SCORE AFTER A QUESTION END
  function evaluate_score(){
    console.log("119");
    var contact_users = "";
      console.log("124" + contacts.length);
      var valid_contacts = 0;
      var res = "Canceled";
      for(var i=0; i<contacts.length; i++) {
        console.log(contacts[i][1] + current_answer);
        var levenshtein_distance = levenshtein(contacts[i][1], current_answer);
        
        if(contacts[i][1] == current_answer || (current_answer.length > 3 && levenshtein_distance <= 2)) {
          valid_contacts++;
          contact_users+=(contacts[i][0])+", ";
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

      var thinker_ans_edit_distance = levenshtein(thinker_answer, current_answer);

      //Match thinker answer or check if edit distance is less than 2
      if(thinker_answer == current_answer || (current_answer.length > 3 && thinker_ans_edit_distance <=2)) {
        res = "Answered Correctly by Thinker";
        //More points for thinker answering correctly
        leaderBoard[currentThinker - 1][1] += 20;
      } else if(valid_contacts > 0) {
        res = "Answered Inorrectly by Thinker";
        revealed_length ++;
        var j = -1;
    		for(j = 0; j < leaderBoard.length; j++) {
    			if(leaderBoard[j][0] === current_questioner) {
    				leaderBoard[j][1] += 10*valid_contacts;
    				break;
    			}
    		}
        if(revealed_length >= current_word.length) {
          io.emit('chat message', "Round ended. The word was " + current_word + ". Baton passes to next thinker.");
          gameStarted = false;
          revealed_length = 1;
          io.emit('round end');
        }
      }


      lockState = "";
      io.emit('chat message', "Question " +res);
      io.emit("chat message", "The answer was "+ current_answer);
      if(contact_users != "")
        io.emit("chat message", contact_users.substring(0,contact_users.length-2)+ " correctly did a contact."); 
      io.emit("The revealed word now is " + current_word.substring(0,revealed_length));
      io.emit('enable question');
      io.emit('update score', leaderBoard);
      io.emit('reveal word',current_word.substring(0,revealed_length), current_word.length -revealed_length);
      io.emit("refresh data", leaderBoard);

      console.log("147");
    for(var i=0; i<contacts.length; i++)
      contacts[i].splice(0);
    contacts.splice(0);
    current_question = "";
    thinker_answer = "";
    current_answer = "";
    hasThinkerAnswered = 0;     // Resetting thinker answer boolean
	  logState();
}

  //ON WORD GUESS
  socket.on("word guess", function(user, guess){
    guess = guess.toLowerCase();
    guess = guess.trim();
    console.log("Word Guess by" + user);

    //get user id
    if(gameStarted == false || current_word === "" || user === leaderBoard[currentThinker - 1][0]) {
      socket.emit("chat message","Not eligible to guess");
    } else {
      var j = -1;
      for(j = 0; j < leaderBoard.length; j++) {
        if(leaderBoard[j][0] === user) 
         break;
      }
    }
    var levenshtein_distance = levenshtein(guess, current_word);
    if(guess === current_word || (current_word.length > 3 && levenshtein_distance <= 1)){
      socket.emit("chat message", "Correct guess : " + guess + ". Points added");
			io.emit("chat message", user + " guessed the word correctly");
	    		leaderBoard[j][1] += 5*(current_word.length - revealed_length);
	    		io.emit('chat message', "Round ended. The word was " + current_word + ". Baton passes to next thinker.");
				gameStarted = false;
				revealed_length = 1;
				io.emit('round end');
				io.emit("refresh data", leaderBoard);
    }else {
      socket.emit("chat message", "Wrong guess : " + guess + ". Points deducted");
      io.emit("chat message", user + " made a wrong guess");
      leaderBoard[j][1] -= 5*revealed_length;
      io.emit("refresh data", leaderBoard);
    }

  });

  socket.on("send message", function(user, message){
    console.log("Multicast message : " + message);
    var msg = message.toLowerCase();
    console.log(msg);
   	io.emit("chat message", user+": "+message);
    });

});

http.listen(port, function(){
  console.log('listening on *:' + port);
});

