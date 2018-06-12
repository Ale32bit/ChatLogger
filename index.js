/*
 * ChatLogger Server (c) 2018 Ale32bit
 *
 * LICENSE: GNU GPLv3
 * Full license: https://github.com/Ale32bit/ChatLogger/blob/master/LICENSE
 */

const WebSocket = require("ws");
const http = require('http');
const sqlite = require("sqlite");
const fs = require("fs");
const stdin = process.openStdin();
const url = require("url");
const mcping = require('mc-ping-updated');
const config = require("./config.json");
const maxLoad = 500;
const defLoad = 100;

const token = config.listenersToken; // listener slave token
const port = config.port;

const chatMods = {
    Ale32bit: true,
    SquidDev: true,
    Yemmel: true,
    Wojbie: true,
    Lemmmy: true,
    "1lann": true,
    "3d6": true,
    BTC: true,
    Lignum: true,
};

const cmdBan = {
    Steve: false,
};

if(!fs.existsSync(__dirname+"/tokens.json")){
    fs.writeFileSync(__dirname+"/tokens.json","{}");
}

const bindTokens = require("./tokens.json");

const setToken = function(token,value){
    bindTokens[token] = value;
    fs.writeFileSync(__dirname+"/tokens.json",JSON.stringify(bindTokens,(key, value) => {
        if (value !== null) return value
    },4));
};

if(!fs.existsSync(__dirname+"/muted.json")){
    fs.writeFileSync(__dirname+"/muted.json","{}");
}

const muted = require("./muted.json");

const setMute = function(player,value){
    muted[player] = value;
    fs.writeFileSync(__dirname+"/muted.json",JSON.stringify(muted,(key, value) => {
        if (value !== null) return value
    },4));
};

if(!fs.existsSync(__dirname+"/subs.json")){
    fs.writeFileSync(__dirname+"/subs.json","{}");
}

const subscribedUsers = require("./subs.json");

const setSub = function(user,value){
    subscribedUsers[user] = value;
    fs.writeFileSync(__dirname+"/subs.json",JSON.stringify(subscribedUsers,(key, value) => {
        if (value !== null) return value
    },4));
};

const getID = function(){
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + s4() + s4() + s4() + s4() + s4();
};

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const getPlayers = function(errcb,cb){
    var players = [];
    var maxPlayers = 0;
    var online = false;
    mcping('switchcraft.pw', 25565, function(err,res){
        if (err) {
            // Some kind of error
            online = false;
            if(typeof(errcb)==="function") {
                errcb({
                    players: players,
                    online: online,
                    maxPlayers: maxPlayers,
                })
            }

        } else {
            // Success!
            online = true;
            maxPlayers = res.players.max;
            players = res.players.sample;
            if(typeof(cb) === "function") {
                cb({
                    players: players,
                    online: online,
                    maxPlayers: maxPlayers,
                })
            }

        }
    },3000);
};

const deaths = {
    lightningBolt: "%1$s was struck by lightning",
    inFire: "%1$s went up in flames",
    "inFire.player": "%1$s walked into fire whilst fighting %2$s",
    onFire: "%1$s burned to death",
    "onFire.player": "%1$s was burnt to a crisp whilst fighting %2$s",
    lava: "%1$s tried to swim in lava",
    "lava.player": "%1$s tried to swim in lava to escape %2$s",
    hotFloor: "%1$s discovered floor was lava",
    "hotFloor.player": "%1$s walked into danger zone due to %2$s",
    inWall: "%1$s suffocated in a wall",
    cramming: "%1$s was squished too much",
    drown: "%1$s drowned",
    "drown.player": "%1$s drowned whilst trying to escape %2$s",
    starve: "%1$s starved to death",
    cactus: "%1$s was pricked to death",
    "cactus.player": "%1$s walked into a cactus whilst trying to escape %2$s",
    generic: "%1$s died",
    explosion: "%1$s blew up",
    "explosion.player": "%1$s was blown up by %2$s",
    magic: "%1$s was killed by magic",
    wither: "%1$s withered away",
    anvil: "%1$s was squashed by a falling anvil",
    fallingBlock: "%1$s was squashed by a falling block",
    mob: "%1$s was slain by %2$s",
    player: "%1$s was slain by %2$s",
    arrow: "%1$s was shot by %2$s",
    fireball: "%1$s was fireballed by %2$s",
    thrown: "%1$s was pummeled by %2$s",
    indirectMagic: "%1$s was killed by %2$s using magic",
    thorns: "%1$s was killed trying to hurt %2$s",
    fall: "%1$s hit the ground too hard",
    outOfWorld: "%1$s fell out of the world",
    dragonBreath: "%1$s was roasted in dragon breath",
    flyIntoWall: "%1$s experienced kinetic energy",
    fireworks: "%1$s went off with a bang",
    laser: "%1$s was vapourised by %2$s"
};

const CLIENTS = {};
const messages = [];
const bindCodes = {};
const lockedBind = {};
const ratelimit = {};
const onlinePlayers = {};

console.log("Starting up...");
console.log("PID: "+process.pid);
console.log("Port: "+config.port);

var db;

var convertData = function(event,data,timestamp){
    if(typeof(data) === "string") {
        try {
            data = JSON.parse(data);
        } catch (e) {
            console.error(e);
        }
    }

    switch (event){
        case "chat_message":
            return {
                player: data.player,
                message: data.message,
                event: event,
                timestamp: timestamp,
                type: "event",
            };
        case "death_message":
            return {
                player: data.player,
                pretty: data.pretty,
                killer: data.killer,
                raw: data.raw,
                event: event,
                timestamp: timestamp,
                type: "event",
            };
        case "connection_activity":
            return {
                player: data.player,
                activity: data.activity,
                event: event,
                timestamp: timestamp,
                type: "event",
            };
        case "chatbox_message":
            return {
                prefix: data.prefix,
                x: data.x,
                y: data.y,
                z: data.z,
                label: data.label,
                message: data.message,
                event: event,
                timestamp: timestamp,
                type: "event",
            };
        case "console_message":
            return {
                message: data.message,
                event: event,
                timestamp: timestamp,
                type: "event",
            };
        case "user_message":
            return {
                message: data.message,
                name: data.name,
                event: event,
                timestamp: timestamp,
                type: "event",
            };
    }
};

(async ()=>{
    db = await sqlite.open('data.sqlite', {Promise});
    await db.run('CREATE TABLE IF NOT EXISTS data(id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, event TEXT, timestamp INT)');
    var rows = await db.all("SELECT * FROM data ORDER BY id DESC LIMIT $limit",{
        $limit: maxLoad,
    });
    for(var k in rows){
        var v = rows[k];
        messages.push(convertData(v.event, v.data, v.timestamp))
    }
    messages.reverse();
    console.log(messages.length)
})();

var httpsServer = http.createServer(/*{
    key: fs.readFileSync('/etc/letsencrypt/live/pi.ale32bit.me/privkey.pem','utf8'),
    cert: fs.readFileSync('/etc/letsencrypt/live/pi.ale32bit.me/cert.pem','utf8'),
    ca: fs.readFileSync('/etc/letsencrypt/live/pi.ale32bit.me/chain.pem','utf8'),
},*/(req,res)=>{
    console.log("Received http request: "+req.connection.remoteAddress);
    var output = [];
    var limit = defLoad;
    let args = url.parse(req.url, true).query;
    if(args.limit && Number(args.limit)){
        limit = Number(args.limit);
    }

    if(limit > messages.length) limit=maxLoad;


    for (var i = messages.length; i > (messages.length-1)-limit; i--){
        if(messages[i]) {
            output.unshift(messages[i]);
        }
    }

    res.writeHead(200,{
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': "*"
    });

    res.write(JSON.stringify(output)); //write a response to the client
    res.end(); //end the response
});
httpsServer.listen(port);

var WebSocketServer = WebSocket.Server;
var wss = new WebSocketServer({
    server: httpsServer
});

wss.getUniqueID = function () {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    }
    return s4() + s4() + '-' + s4();
};

const isSubscribed = function(uuid,event){
    if(event === "chat_message"){
        if(CLIENTS[uuid].events.chat) return true;
    }else if(event === "death_message"){
        if(CLIENTS[uuid].events.death) return true;
    }else if(event === "connection_activity"){
        if(CLIENTS[uuid].events.connection) return true;
    }else if(event === "console_message") {
        if (CLIENTS[uuid].events.console) return true;
    }else if(event === "chatbox_message") {
        if (CLIENTS[uuid].events.chatbox) return true;
    }else if(event === "user_message") {
        if (CLIENTS[uuid].events.user) return true;
    }
    return false;
};

const fireEvent = function(event, objArgs){
    var timestamp = Math.floor(new Date() / 1000);
    if(typeof(objArgs) !== "object"){
        throw new Error("objArgs must be an object!");
    }

    db.run('INSERT INTO data (data,event,timestamp) VALUES ($data, $event, $timestamp)', { //Insert into db
        $data: JSON.stringify(objArgs),
        $event: event,
        $timestamp: timestamp,
    });

    messages.push(convertData(event,objArgs,timestamp)); // Add message to messages list for web
    messages.shift(); // removes first message of array

    objArgs.timestamp = timestamp;
    objArgs.event = event;
    objArgs.type = "event";

    wss.clients.forEach(function each(client){
        if(isSubscribed(client.id, event) && client.readyState === WebSocket.OPEN){
            objArgs.uuid = client.id;
            client.send(JSON.stringify(objArgs),()=>{});
        }
    });
};

const tellSlaves = function(event,objArgs){
    var timestamp = Math.floor(new Date() / 1000);
    if(typeof(objArgs) !== "object") {
        throw new Error("objArgs must be an object!");
    }

    objArgs.timestamp = timestamp;
    objArgs.event = event;
    objArgs.type = "event";

    wss.clients.forEach(function each(client){
        if(CLIENTS[client.id].slave && client.readyState === WebSocket.OPEN){
            objArgs.uuid = client.id;
            client.send(JSON.stringify(objArgs),()=>{});
        }
    });
};

const clCommands = {
    bind: (player) =>{
        if(!lockedBind[player]) {
            var code = getRandomInt(111111, 999999).toString();
            bindCodes[code] = player;
            lockedBind[player] = true;
            console.log(bindCodes);
            tellSlaves("tell", {
                label: "Bind",
                message: "&6Your bind code is: &c" + code + "\n&cThis code will expire in 1 minute!",
                player: player,
            });
            setTimeout(function () {
                bindCodes[code] = null;
                lockedBind[player] = false;
            }, 60000)
        } else {
            tellSlaves("tell", {
                label: "Bind",
                message: "Your previous bind code didn't expire yet!",
                player: player,
            });
        }
    },
    unbind: (player)=>{
        for(var k in bindTokens){
            if(bindTokens[k] && bindTokens[k].player === player){
                setToken(k,null);
            }
        }
        tellSlaves("tell",{
            label:"Server",
            message:"Unbinded from all clients!",
            player:player,
        })
    },
    credits: (player)=>{
        tellSlaves("tell",{
            label:"Server",
            message:"Created by Ale32bit for SwitchCraft Server!",
            player:player,
        })
    },
    help: (player)=>{
        tellSlaves("tell",{
            label:"Server",
            message:"\n&c-- &6ChatLogger &bHelp &c--\n" +
            "&7subscribe&a: Subscribe to external messages\n" +
            "&7unsubscribe&a: Unsubscribe from external messages\n" +
            "&7bind&a: Get a bind code for chatting\n" +
            "&7unbind&a: Invalidates all your chat tokens\n" +
            "&7credits&a: Credits\n" +
            "&7help&a: Shows this help\n" +
            "&cmute &7<player>&a: Mute a player. &c(Only for server admins and moderators!)",
            player:player,
        })
    },
    mute: (player,args)=>{
        if(chatMods[player]){
            if(args[0]){
                var p = args[0].toString();
                if (!chatMods[p]){
                    if(muted[p]){
                        setMute(p,false);
                        tellSlaves("tell",{
                            label:"Server",
                            message:"&a"+p+" &6unmuted from ChatLog!",
                            player:player,
                        })
                    } else {
                        setMute(p,true);
                        tellSlaves("tell",{
                            label:"Server",
                            message:"&a"+p+" &6muted from ChatLog!",
                            player:player,
                        })
                    }
                } else {
                    tellSlaves("tell",{
                        label:"Server",
                        message:"You can't mute another ChatLog Moderator!",
                        player:player,
                    })
                }
            } else {
                tellSlaves("tell",{
                    label:"Server",
                    message:"Usage: \\cl mute <player>",
                    player:player,
                })
            }
        }else{
            tellSlaves("tell",{
                label:"Server",
                message:"You are not a ChatLog moderator",
                player:player,
            })
        }
    },
    subscribe: function(player){
        setSub(player,true);
        tellSlaves("tell",{
            label:"Server",
            message:"&aSubscribed to external messages!",
            player:player,
        })
    },
    unsubscribe: function(player){
        setSub(player,false);
        tellSlaves("tell",{
            label:"Server",
            message:"&cUnsubscribed from external messages!",
            player:player,
        })
    }
};

wss.on('connection', function connection(ws,req) {

    ws.id = wss.getUniqueID();

    CLIENTS[ws.id] = {};
    CLIENTS[ws.id].slave = false;
    CLIENTS[ws.id].events = {};
    CLIENTS[ws.id].failedAuth = 0;
    ratelimit[ws.id] = 0;

    var id = setInterval(function () {
        ws.send(JSON.stringify({type:"ping",timestamp:Math.floor(new Date() / 1000)}), function () { /* ignore errors */ });
        ratelimit[ws.id] = 0;
    }, 10000);
    ws.ip = req.headers['x-forwarded-for'].split(/\s*,\s*/)[0];
    console.log('started client interval. ID '+ws.id+". "+ws.ip);

    ws.on('error', (error) => {
        console.log(ws.id+" errored");
        console.error(error);
    });

    ws.on('message', async function incoming(message,req) {
        if(!CLIENTS[ws.id].slave){
            ratelimit[ws.id]++;
            if(ratelimit[ws.id] > 100){
                ws.send(JSON.stringify({
                    type:"error",
                    reason:"ratelimit exceeded",
                }));
                ws.terminate();
            }
        }
        try {
            var data = JSON.parse(message);
        } catch (e) {
            console.error(e.toString());
            ws.send(JSON.stringify({
                error: "Invalid syntax! JSON expected",
            }));
            return;
        }

        //var ip = req.connection.remoteAddress;
        var ip = ws._socket.remoteAddress;
        if(data.type){
            if(!data.id || !Number.isInteger(data.id)){
                data.id = 0;
            }
            if(data.type === "auth" && data.token) {
                if (data.token === token) {
                    CLIENTS[ws.id].slave = true;

                    ws.send(JSON.stringify({
                        type: "auth",
                        status: CLIENTS[ws.id].slave,
                        uuid: ws.id,
                        id: data.id,
                    }));
                    tellSlaves("tell", {
                        label: "Slave",
                        message: "Started",
                        player: "Ale32bit",
                    });
                    console.log("Listener ID " + ws.id + " instance started!");
                } else {
                    console.log("Failed auth: "+ws.id);
                    CLIENTS[ws.id].failedAuth++;
                    if (CLIENTS[ws.id].failedAuth  > 2){
                        console.log("Killed "+ws.id+" because too many failed auth attempts!");
                        ws.terminate();
                    }
                }
                return;
            }else if(data.type === "subscribe" && data.event){
                switch(data.event){
                    case "chat_message":
                        CLIENTS[ws.id].events.chat = true;
                        break;
                    case "death_message":
                        CLIENTS[ws.id].events.death = true;
                        break;
                    case "connection_activity":
                        CLIENTS[ws.id].events.connection = true;
                        break;
                    case "console_message":
                        CLIENTS[ws.id].events.console = true;
                        break;
                    case "chatbox_message":
                        CLIENTS[ws.id].events.chatbox = true;
                        break;
                    case "user_message":
                        CLIENTS[ws.id].events.user = true;
                        break;
                    default:
                        ws.send(JSON.stringify({
                            type:"subscribe",
                            status: false,
                            event: data.event,
                            reason:"Unknown event",
                            uuid:ws.id,
                            id:data.id,
                        }));
                        return;
                }
                ws.send(JSON.stringify({
                    type:"subscribe",
                    status: true,
                    event: data.event,
                    uuid:ws.id,
                    id:data.id,
                }));
                return;
            }else if(data.type === "unsubscribe" && data.event){
                switch(data.event){
                    case "chat_message":
                        CLIENTS[ws.id].events.chat = false;
                        break;
                    case "death_message":
                        CLIENTS[ws.id].events.death = false;
                        break;
                    case "connection_activity":
                        CLIENTS[ws.id].events.connection = false;
                        break;
                    case "console_message":
                        CLIENTS[ws.id].events.console = false;
                        break;
                    case "chatbox_message":
                        CLIENTS[ws.id].events.chatbox = false;
                        break;
                    case "user_message":
                        CLIENTS[ws.id].events.chatbox = false;
                        break;
                    default:
                        ws.send(JSON.stringify({
                            type:"subscribe",
                            status: false,
                            event: data.event,
                            reason:"Unknown event",
                            uuid:ws.id,
                            id:data.id,
                        }));
                        return;
                }
                ws.send(JSON.stringify({
                    type:"unsubscribe",
                    status: true,
                    event: data.event,
                    uuid:ws.id,
                    id:data.id,
                }));
                return;
            }else if(data.type === "players"){
                getPlayers(function error(stats){
                    ws.send(JSON.stringify({
                        type:"players",
                        players:stats.players,
                        online:stats.online,
                        maxPlayers: stats.maxPlayers,
                        uuid:ws.id,
                        id:data.id,
                    }));
                }, function cb(stats){
                    ws.send(JSON.stringify({
                        type:"players",
                        players:stats.players,
                        online:stats.online,
                        maxPlayers: stats.maxPlayers,
                        uuid:ws.id,
                        id:data.id,
                    }));
                });

            } else if(data.type === "bind") {
                if (typeof(data.code) === "string") {
                    if (bindCodes[data.code]) {
                        let token = getID();
                        setToken(token, {
                            player: bindCodes[data.code],
                        });
                        ws.send(JSON.stringify({
                            type: "bind",
                            status: true,
                            player: bindCodes[data.code],
                            token: token,
                            uuid: ws.id,
                            id: data.id,
                        }));
                        console.log("Binded " + bindCodes[data.code] + " " + data.code);
                        bindCodes[data.code] = null;
                    } else {
                        ws.send(JSON.stringify({
                            type: "bind",
                            status: false,
                            reason: "invalid bind code",
                            uuid: ws.id,
                            id: data.id,
                        }));
                    }
                } else {
                    ws.send(JSON.stringify({
                        type: "bind",
                        status: false,
                        reason: "expected string code",
                        uuid: ws.id,
                        id: data.id,
                    }));
                }
            } else if(data.type === "token_info"){
                if(typeof(data.token) === "string"){
                    if(bindTokens[data.token]){
                        ws.send(JSON.stringify({
                            type: "token_info",
                            status: true,
                            player: bindTokens[data.token].player,
                            uuid: ws.id,
                            id: data.id,
                        }));
                    }else{
                        ws.send(JSON.stringify({
                            type: "token_info",
                            status: false,
                            reason: "invalid token",
                            uuid: ws.id,
                            id: data.id,
                        }));
                    }
                }else {
                    ws.send(JSON.stringify({
                        type: "token_info",
                        status: false,
                        reason: "expected string token",
                        uuid: ws.id,
                        id: data.id,
                    }));
                }
            } else if(data.type === "send_message"){
                if(typeof(data.token) === "string" && typeof(data.message) === "string"){
                    if(bindTokens[data.token]){
                        if(!muted[bindTokens[data.token].player]) {
                            if (!onlinePlayers[bindTokens[data.token].player]) {
                                data.message = data.message.substring(0, 255);
                                console.log("[" + ip + "] " + bindTokens[data.token].player + "> " + data.message);
                                var toPlayers = [];
                                for(var k in subscribedUsers){
                                    if(subscribedUsers[k]){
                                        toPlayers.push(k);
                                    }
                                }
                                fireEvent("user_message", {
                                    name: bindTokens[data.token].player,
                                    message: data.message,
                                    players: toPlayers,
                                });
                                ws.send(JSON.stringify({
                                    type: "send_message",
                                    status: true,
                                    uuid: ws.id,
                                    id: data.id,
                                }));
                            } else {
                                ws.send(JSON.stringify({
                                    type: "send_message",
                                    status: false,
                                    reason: "player is online",
                                    uuid: ws.id,
                                    id: data.id,
                                }));
                            }
                        }else{
                            ws.send(JSON.stringify({
                                type: "send_message",
                                status: false,
                                reason: "player is muted",
                                uuid: ws.id,
                                id: data.id,
                            }));
                        }
                    }
                }
            }

            if(CLIENTS[ws.id].slave) {
                if (data.type === "chat_message") { // Message type
                    console.log("[" + ip + "] " + data.player + "> " + data.message);
                    fireEvent("chat_message",{
                        player: data.player,
                        message: data.message,
                    });
                } else if (data.type === "connection_activity") { // Login type
                    console.log("[" + ip + "] " + data.player + " " + data.message);
                    fireEvent("connection_activity",{
                        player: data.player,
                        activity: data.message,
                    });
                    data.message === "join" ? onlinePlayers[data.player] = true : onlinePlayers[data.player] = false;
                } else if (data.type === "death_message") { // Death type
                    var ms = deaths[data.death] || "%1$s died";
                    ms = ms.replace("%1$s", data.player);
                    ms = ms.replace("%2$s", (data.killer || "Unknown"));
                    console.log("[" + ip + "] " + ms);
                    fireEvent("death_message", {
                        player: data.player,
                        pretty: ms,
                        killer: data.killer,
                        raw: data.death,
                    });
                } else if(data.type === "chatbox_message") {
                    console.log("[" + ip + "] " + data.prefix + "[" + data.x + "," + data.y + "," + data.z + "] " + data.label + ": " + data.message);
                    fireEvent("chatbox_message",{
                        prefix: data.prefix,
                        x: data.x,
                        y: data.y,
                        z: data.z,
                        label: data.label,
                        message: data.message,
                    });
                } else if(data.type === "command"){
                    console.log(data.player+" \\"+data.commands.join(" "));
                    if(cmdBan[data.player]){
                        tellSlaves("tell",{
                            label: "Server",
                            message: "You are banned from the ChatLog command interface!",
                            player: data.player,
                        });
                        return;
                    }
                    var command = data.commands[0];
                    var args = [];
                    for (i=1;i<data.commands.length;i++){
                        args.push(data.commands[i])
                    }
                    if (clCommands[command]){
                        try {
                            clCommands[command](data.player,args);
                        } catch(e) {
                            tellSlaves("tell",{
                                label: "Server",
                                message: e.toString(),
                                player: data.player,
                            });
                            console.error(e)
                        }
                    } else {
                        tellSlaves("tell",{
                            label: "Server",
                            message: "&cInvalid command. Run &7\\cl help&c for help!",
                            player: data.player,
                        })
                    }
                }
            }
        }
    });

    ws.on('close', function () {
        console.log('stopping client interval ID '+ws.id);
        if(CLIENTS[ws.id].slave){
            console.log("Listener ID "+ws.id + " instance stopped!")
        }
        CLIENTS[ws.id] = undefined;
        clearInterval(id);
    });
    ws.send(JSON.stringify({type:"motd",motd:"Welcome to the SwitchCraft ChatLogger server! (c) 2018 Ale32bit",uuid:ws.id}));
});

/*client.on("message",message=>{
    if(message.channel.id === channelID && message.author.id !== client.user.id){
        console.log("DISCORD "+message.author+"> "+message.content);
        var timestamp = Math.floor(new Date() / 1000);
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                if(CLIENTS[client.id].events.discord) {
                    client.send(JSON.stringify({
                        name: message.author.username,
                        message: message.content,
                        timestamp: timestamp,
                        type: "discord_chat",
                        id: client.id,
                        warning:"This event will be removed in future.",
                    }));
                }
            }
        });
    }
});*/

const cnsC = {
    bind: (player)=>{
        var code = getRandomInt(111111, 999999).toString();
        bindCodes[code] = player;
        console.log(code);
        setTimeout(function () {
            bindCodes[code] = null;
        }, 60000)
    },
    say:(txt)=>{
        fireEvent("console_message",{
            message: txt,
        });
    },
};

stdin.addListener("data", function(d) {
    var message = d.toString().trim().split(" ");
    var cmd = message[0];
    var arg = "";
    for(i=1;i<message.length;i++){
        arg=+message[i]+" "
    }
    try{
        cnsC[cmd](arg)
    }catch (e) {
        console.error(e)
    }
});

function exitHandler(options, err) {
    if (err) console.log(err.stack);
    if (options.exit) {
        try {
            console.log("Closing database...");
            db.close();
        } catch (e) {
            console.error(e);
        }
        process.exit(0);
    }
}

var scbp = (stats)=>{
    if(stats.online) {
        for (var k in stats.players) {
            onlinePlayers[stats.players[k].name] = true;
        }
    }
};

getPlayers(scbp,scbp);

//do something when app is closing
process.on('exit', exitHandler.bind(null,{exit:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:false})); // this is really unsafe and can fuck the whole database up

console.log("Ready");
