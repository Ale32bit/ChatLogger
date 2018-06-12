const WebSocket = require("ws");
const https = require('https');
const sqlite = require("sqlite");
const fs = require("fs");
const xml2js = require("xml2js");
const stdin = process.openStdin();
const url = require("url");
const Discord = require("discord.js");
const client = new Discord.Client();
const port = 443;

const token = ""; // listener token
const discordToken = ""; // discord bot token

var guildID = "418704183466786826";
var channelID = "418704215914053632";
var logID = "420523089323884557";

const CLIENTS = {};

const onlinePlayers = {};

const messages = [];

var deaths = {
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
};

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.login(discordToken);

function disc(mess){
    try {
        client.guilds.get(guildID).channels.get(channelID).send(mess);
    } catch(e){
        // do nothing
    }
}
function disclog(mess){
    try {
        client.guilds.get(guildID).channels.get(logID).send(mess);
    } catch(e){
        // do nothing
    }
}

async function test() {
    var db = await sqlite.open('data.sqlite', {Promise});
    db.run('CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, player TEXT, message TEXT, timestamp INT, type TEXT)');
    db.close();
}

test();

var db;

async function startAll() {
    db = await sqlite.open('data.sqlite', {Promise});
    var rows = await db.all("SELECT * FROM messages ORDER BY id DESC");
    for(var k in rows){
        var v = rows[k];
        messages.push({
            player: v.player,
            message: v.message,
            timestamp: v.timestamp,
            type: v.type,
        })
    }
    console.log(messages.length)
}

startAll();

var httpsServer = https.createServer({
    key: fs.readFileSync('certs/privkey.pem','utf8'),
    cert: fs.readFileSync('certs/cert.pem','utf8'),
    ca: fs.readFileSync('certs/chain.pem','utf8'),
},(req,res)=>{
    console.log("Received http request: "+req.connection.remoteAddress);
    var output = [];
    var limit = 100;
    let args = url.parse(req.url, true).query;
    if(args.limit && Number(args.limit)){
        limit = Number(args.limit);
    }

    if(limit > messages.length) limit=messages.length;

    for(var i=0;i<limit;i++){
        output.push(messages[i])
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

wss.on('connection', function connection(ws,req) {

    ws.id = wss.getUniqueID();

    var id = setInterval(function () {
        ws.send(JSON.stringify({type:"ping",timestamp:Math.floor(new Date() / 1000)}), function () { /* ignore errors */ });
    }, 10000);
    console.log('started client interval. ID '+ws.id+". Interval ID "+id);

    CLIENTS[ws.id] = {};
    CLIENTS[ws.id].slave = false;
    CLIENTS[ws.id].events = {};

    ws.on('message', async function incoming(message,req) {
        var data = JSON.parse(message);

        //var ip = req.connection.remoteAddress;
        var ip = ws._socket.remoteAddress;
        if(data.type){
            if(data.type === "auth" && data.token){
                if(data.token === token){
                    CLIENTS[ws.id].slave = true;
                }
                ws.send(JSON.stringify({
                    type:"auth",
                    status: CLIENTS[ws.id].slave,
                    id:ws.id
                }));
                disclog("Listener ID "+ws.id + " instance started!");
                console.log("Listener ID "+ws.id + " instance started!");
                return;
            }else if(data.type === "subscribe" && data.event){
                if(data.event === "chat"){
                    CLIENTS[ws.id].events.chat = true;
                }else if(data.event === "discord_chat") {
                    CLIENTS[ws.id].events.discord = true;
                }else if(data.event === "console_message"){
                    CLIENTS[ws.id].events.console = true;
                }
                ws.send(JSON.stringify({
                    type:"subscribe",
                    status: true,
                    event: data.event,
                    id:ws.id
                }));
                return;
            }else if(data.type === "unsubscribe" && data.event){
                if(data.event === "chat"){
                    CLIENTS[ws.id].events.chat = false;
                } else if(data.event === "discord_chat") {
                    CLIENTS[ws.id].events.discord = false;
                }else if(data.event === "console_message") {
                    CLIENTS[ws.id].events.console = false;
                }
                ws.send(JSON.stringify({
                    type:"unsubscribe",
                    status: true,
                    event: data.event,
                    id:ws.id
                }));
                return;
            }else if(data.type === "online"){
                var players = [];
                for(var k in onlinePlayers){
                    if(onlinePlayers[k]){
                        players.push(k)
                    }
                }
                ws.send(JSON.stringify({type:"online",online:players,id:ws.id}));
            }

            if(CLIENTS[ws.id].slave) {

                var message;

                if (data.type === "message") { // Message type
                    message = data.message;
                    onlinePlayers[data.player] = true;
                    disc("`" + data.player + "` " + data.message);
                    console.log("[" + ip + "] " + data.player + "> " + data.message);
                } else if (data.type === "login") { // Login type
                    message = data.message;
                    if(data.message === "joined"){
                        onlinePlayers[data.player] = true;
                    } else {
                        onlinePlayers[data.player] = false;
                    }
                    disc("**" + data.player + " " + data.message + "**");
                    console.log("[" + ip + "] " + data.player + " " + data.message);
                } else if (data.type === "death") { // Death type
                    var ms;
                    if (deaths[data.death]) {
                        ms = deaths[data.death];
                    } else {
                        ms = "%1$s died";
                    }
                    ms = ms.replace("%1$s", data.player);
                    ms = ms.replace("%2$s", (data.killer || "Unknown"));
                    message = ms;
                    disc("*" + ms + "*");
                    console.log("[" + ip + "] " + message);
                } else { // Return if illegal
                    return;
                }

                var timestamp = Math.floor(new Date() / 1000); //Gen unix time
                messages.unshift({ // Add message to messages list for web
                    player: data.player,
                    message: message,
                    timestamp: timestamp,
                    type: data.type,
                });

                db.run('INSERT INTO messages (ip,player,message,timestamp,type) VALUES ($ip, $player,$message,$timestamp,$type)', { //Insert into db
                    $ip: ip,
                    $player: data.player,
                    $message: message,
                    $timestamp: timestamp,
                    $type: data.type,
                });

                wss.clients.forEach(function each(client) {
                    if (client.readyState === WebSocket.OPEN) {
                        if(CLIENTS[client.id].events.chat) {
                            client.send(JSON.stringify({
                                player: data.player,
                                message: message,
                                timestamp: timestamp,
                                type: data.type,
                                id:client.id
                            }));
                        }
                    }
                });
            }
        }
    });

    ws.on('close', function () {
        console.log('stopping client interval ID '+ws.id);
        if(CLIENTS[ws.id].slave) disclog("Listener ID "+ws.id + " instance stopped!"); console.log("Listener ID "+ws.id + " instance stopped!");
        CLIENTS[ws.id] = undefined;
        clearInterval(id);
    });
    ws.send(JSON.stringify({type:"motd",motd:"Welcome to my listener! Please provide token if you are a chat listener",id:ws.id}));
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

stdin.addListener("data", function(d) {
    var message = d.toString().trim();
    var timestamp = Math.floor(new Date() / 1000);
    messages.unshift({ // Add message to messages list for web
        player: "console",
        message: message,
        timestamp: timestamp,
        type: "console_message",
    });

    db.run('INSERT INTO messages (ip,player,message,timestamp,type) VALUES ($ip, $player,$message,$timestamp,$type)', { //Insert into db
        $ip: "127.0.0.1",
        $player: "console",
        $message: message,
        $timestamp: timestamp,
        $type: "console_message",
    });
    wss.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            if(CLIENTS[client.id].events.console) {
                client.send(JSON.stringify({
                    message: message,
                    timestamp: timestamp,
                    type: "console_message",
                    id:client.id
                }));
            }
        }
    });
});

function exitHandler(options, err) {
    if (options.cleanup) console.log('clean');
    if (err) console.log(err.stack);
    if (options.exit) {
        db.close();
        process.exit();
    }
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:false}));

console.log("ready");
