--[[
-- ChatLogger CC Slave Listener
-- (c) 2018 Ale32bit
]]--

local ws
local ok, err = pcall(function()
os.loadAPI("json")
local host = "wss://cl.ale32bit.me/"

local token = "TOKEN"
local COMMANDS = {
    cl = true,
    chatlog = true,
}

local convert = function(m)
    return m:gsub("&","\167")
end

local cb = peripheral.find("chat_box")
local messages = {}
local tell = {}

function string.split(str,sep)
    if not sep then
        sep = "%s"
    end
    local out = {}
    for w in string.gmatch(str,"([^"..sep.."]+)") do
        table.insert(out,w)
    end
    return out
end

function tell(player,message,...)
    cb.tell(player,convert(message),...)
end

local uuid

http.websocketAsync(host)

parallel.waitForAny(function()
    while true do
        local ev = {os.pullEvent()}
        if ev[1] == "websocket_success" then
            print("Connected to server")
            ws = ev[3]
            ws.send(json.encode({
                type = "auth",
                token = token,
            }))
            ws.send(json.encode({
                type = "subscribe",
                event = "console_message",
            }))
            ws.send(json.encode({
                type = "subscribe",
                event = "user_message",
            }))
            print("Ready")
        elseif ev[1] == "websocket_message" then
            print(ev[3])
            local ms = json.decode(ev[3])
            if ms.uuid and ms.uuid == uuid then
                if ms.type == "event" then
                    if ms.event == "console_message" then
                        table.insert(messages,{
                            name = "§6[CL] Console§r",
                            message = ms.message,                
                        })
                    elseif ms.event == "user_message" then
                        --[[table.insert(messages,{
                            name = "§a"..ms.name.."§r",
                            message = ms.message,
                            prefix = "§6[CL] §r",
                        })
                        --]]
                        if ms.players then
                            for k,v in pairs(ms.players) do
                                tell(v,ms.message,"§a"..ms.name.."§r","§6[CL] §r")
                            end
                        end
                    elseif ms.event == "tell" then
                        tell(ms.player,ms.message,"§6[CL] §a"..ms.label.."§r")
                    end
                end
            elseif ms.type == "motd" then
                uuid = ms.uuid
                print("Client ID: "..uuid)
            end
        elseif ev[1] == "chat" then
            local player = ev[2]
            local message = ev[3]
            ws.send(json.encode({
                player = player,
                message = message,
                type = "chat_message",
                token=token,
            }))
        elseif ev[1] == "join" then
            ws.send(json.encode({
                player = ev[2],
                message = "join",
                type = "connection_activity",
                token=token,
            }))
        elseif ev[1] == "leave" then
            ws.send(json.encode({
                player=ev[2],
                message = "leave",
                type="connection_activity",
                token=token,
            }))
        elseif ev[1] == "death" then
            ws.send(json.encode({
                player = ev[2],
                death = ev[4],
                killer = ev[3],
                type= "death_message",
                token=token,
            }))
        elseif ev[1] == "chatbox" then
            ws.send(json.encode({
                prefix = ev[2],
                x = ev[3],
                y = ev[4],
                z = ev[5],
                label = ev[6],
                message = ev[7],
                
                type = "chatbox_message",
                token=token,
            }))
        elseif ev[1] == "command" and COMMANDS[ev[3]] then
            ws.send(json.encode({
                player = ev[2],
                commands = ev[4],
                
                type = "command",
                token = token,
            }))
        elseif ev[1] == "websocket_closed" then
            print("closed")
            sleep(1)
            break
        end
    end
end,
function()
    while true do
        for k,v in ipairs(messages) do
            --cb.say(v.message,v.name,v.prefix or "")
            messages[k] = nil
            sleep(1.1)
        end
        sleep(0)
    end
end)
end)
if not ok then
    --pcall(ws.close)
    local f = fs.open("crash.log","a")
    f.write(err.."\n")
    f.close()
    printError(err)
end
