/**
Example Usage:
require('./users.js')();
var players = new UserList();
io.on('connection', function(socket){
	socket.on('disconnect', function() {
		players.disconnect(socket.id);	
	});
	socket.on('add user', function(user) {
		players.connect(new User(user, socket.id));	
	});
});
*/

class CustomError extends Error {
	constructor(message) {
		super(message);
		this.name = "CustomError";
	}
}

class User {
	constructor(name, socketId) {
		if(name === "" || name === "none") {
			throw new CustomError("Illegal user name : [" + name + "]");
		}
		this.name = name;
		this.socketId = socketId;
	}

	getName() { return this.name; }

	getSocketId() { return this.socketId; }
	setSocketId(socketId) { this.socketId = socketId; }
};

class UserList {
	constructor() {
		this.users = {};
		this.activeUsers = new Set();
		this.thinkerOrder = [];
		this.currentQuestioner = "";
	}

	/**
	API: connect
	*/
	connect(u) {
		//Existing Username
		if(u.getName() in this.users) {
			//stil active, don't overwrite
			if(this.activeUsers.has(u.getName()))
				throw new CustomError("Already active user : [" + u.getName() + "]");
		} else {
			this.thinkerOrder.push(u.getName());
		}

		console.log("Added/Updated user");
		this.users[u.getName()] = u;
		this.activeUsers.add(u.getName());
		this.print();
	}

	/**
	API: disconnect
	*/
	disconnect(socketId) {
		for (const [uname, entry] of Object.entries(this.users)) {
			if(entry.getSocketId() === socketId) {
				this.users[uname].setActive(false);
				this.activeUsers.delete(uname);
				console.log("Disconnected : [" + uname + "]");
				break;
			}
		}
		this.print();
	}

	/**
	API: remove
	*/
	remove(userName) {
		if(userName in this.users) {
			delete this.users[userName];
			this.activeUsers.delete(userName);
			this.thinkerOrder = this.thinkerOrder.filter(arrayItem => arrayItem !== userName);
			console.log("Removed user : " + userName);
		}
		this.print();
	}

	/**
	API: getActiveUsers
	*/
	getActiveUsers() {
		return this.activeUsers;
	}

	/**
	API: getCurrentThinker
	*/
	getCurrentThinker() {
		if(this.thinkerOrder.length === 0)
			throw new CustomError("Thinker list not populated");
		return this.thinkerOrder[0];
	}

	/**
	API: goToNextThinker
	*/
	goToNextThinker() {
		if(this.thinkerOrder.length === 0)
			throw new CustomError("Thinker list not populated");
		var first = this.thinkerOrder.shift();
		this.thinkerOrder.push(first);
	}

	/**
	API: setCurrentQuestioner
	*/
	setCurrentQuestioner(userName) {
		if(this.currentQuestioner != "")
			throw new CustomError(this.currentQuestioner + " is already asking a question");
		if(this.activeUsers.has(userName) == false)
			throw new CustomError("Inactive user");
		this.currentQuestioner = userName;
	}

	/**
	API: resetCurrentQuestioner
	*/
	resetCurrentQuestioner() {
		this.currentQuestioner = "";
	}

	/**
	API: getCurrentQuestioner
	*/
	getCurrentQuestioner() {
		if(this.currentQuestioner === "") 
			throw new CustomError("currentQuestioner is empty");
		this.currentQuestioner;
	}

	print() {
		console.log("Users : ");
		for (const [key, value] of Object.entries(this.users)) {
			console.log(key, value);
		}
		console.log("Active Users : " + Array.from(this.getActiveUsers()));
		console.log("Current Thinker : " + this.getCurrentThinker() + " Order : " + this.thinkerOrder);
	}
}

module.exports = function() { 
    this.UserList = UserList;
    this.User = User;
    this.CustomError = CustomError;
}