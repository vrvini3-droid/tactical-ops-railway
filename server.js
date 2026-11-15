'use strict';
// TACTICAL OPS multiplayer reference server — Node.js 20+, ws
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { WebSocketServer, WebSocket } = require('ws');
const PORT = Number(process.env.PORT || 8080);
const MAX_PLAYERS = 8;
const MATCH_SECONDS = 300;
const rooms = new Map();
const clients = new Map();
const room = () => { let r=rooms.get('dock-4x4'); if(!r){r={players:new Map(),startedAt:0,interval:null,kills:new Map()};rooms.set('dock-4x4',r)} return r };
const server = http.createServer((req,res)=>{
  if (req.url === '/health' || req.url === '/healthz') {
    res.writeHead(200, {'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({game:'TACTICAL OPS',status:'online',players:room().players.size,protocol:1}));
    return;
  }
  if (req.url === '/' || req.url === '/index.html' || req.url === '/game') {
    try {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'));
      res.writeHead(200, {'content-type':'text/html; charset=utf-8','cache-control':'no-store'});
      res.end(html);
    } catch (err) {
      res.writeHead(500, {'content-type':'text/plain; charset=utf-8'}); res.end('TACTICAL OPS client not found');
    }
    return;
  }
  res.writeHead(404, {'content-type':'application/json'}); res.end(JSON.stringify({error:'not_found'}));
});
const wss = new WebSocketServer({server,maxPayload:16*1024,perMessageDeflate:false});
function send(ws,type,payload={}){if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type,payload,ts:Date.now()}))}
function broadcast(r,type,payload={},except=null){for(const p of r.players.values())if(p.ws!==except)send(p.ws,type,payload)}
function snapshot(r){return [...r.players.values()].map(p=>({id:p.id,name:p.name,x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch,hp:p.hp,weapon:p.weapon,team:p.team,aiming:p.aiming,crouched:p.crouched,prone:p.prone,sprinting:p.sprinting,kills:p.kills,deaths:p.deaths}))}
function endMatch(r){if(!r.startedAt)return;const board=snapshot(r).sort((a,b)=>b.kills-a.kills);broadcast(r,'match_end',{board});r.startedAt=0;}
function lineDistance(px,pz,ox,oz,dx,dz){const t=(px-ox)*dx+(pz-oz)*dz;if(t<0||t>34)return Infinity;return Math.hypot(px-(ox+dx*t),pz-(oz+dz*t))}
wss.on('connection',(ws,req)=>{
  ws.id=randomUUID();ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
  ws.on('message',(raw)=>{let msg;try{msg=JSON.parse(raw.toString())}catch{return}if(!msg||typeof msg.type!=='string')return;const p=msg.payload||{};
    if(msg.type==='client_hello'){const r=room();if(r.players.size>=MAX_PLAYERS){send(ws,'error',{code:'ROOM_FULL',message:'Sala cheia'});ws.close(1008,'room full');return}const player={id:ws.id,ws,name:String(p.name||'Operador').slice(0,20),x:0,z:12.5,yaw:0,pitch:0,hp:100,weapon:0,team:r.players.size%2,kills:0,deaths:0,aiming:false,crouched:false,prone:false,sprinting:false,lastState:0};r.players.set(player.id,player);clients.set(ws,player);send(ws,'welcome',{id:player.id,players:r.players.size,room:'dock-4x4'});broadcast(r,'player_join',{id:player.id,name:player.name,team:player.team},ws);send(ws,'snapshot',{players:snapshot(r)});return}
    const player=clients.get(ws);if(!player)return;const r=room();
    if(msg.type==='join_room'){send(ws,'room_joined',{room:'dock-4x4',players:r.players.size});send(ws,'snapshot',{players:snapshot(r)});return}
    if(msg.type==='match_start'){if(!r.startedAt){r.startedAt=Date.now();if(r.interval)clearInterval(r.interval);r.interval=setInterval(()=>{if(r.startedAt&&Date.now()-r.startedAt>=MATCH_SECONDS*1000)endMatch(r);},1000);broadcast(r,'match_started',{duration:MATCH_SECONDS,startedAt:r.startedAt})}return}
    if(msg.type==='player_state'){const now=Date.now();if(now-player.lastState<35)return;player.lastState=now;const num=(v,d=0)=>Number.isFinite(Number(v))?Math.max(-100,Math.min(100,Number(v))):d;player.x=num(p.x);player.z=num(p.z);player.yaw=num(p.yaw);player.pitch=Math.max(-1.3,Math.min(1.3,num(p.pitch)));player.hp=Math.max(0,Math.min(100,num(p.hp,100)));player.weapon=p.weapon===1?1:0;player.aiming=!!p.aiming;player.crouched=!!p.crouched;player.prone=!!p.prone;player.sprinting=!!p.sprinting;return}
    if(msg.type==='fire'){const ox=Number(p.x),oz=Number(p.z),dx=Number(p.dx),dz=Number(p.dz);if(![ox,oz,dx,dz].every(Number.isFinite))return;const len=Math.hypot(dx,dz)||1;let target=null,best=.72;for(const other of r.players.values()){if(other.id===player.id||other.hp<=0)continue;const d=lineDistance(other.x,other.z,ox,oz,dx/len,dz/len);if(d<best){best=d;target=other}}broadcast(r,'shot',{id:player.id,x:ox,z:oz,dx:dx/len,dz:dz/len,weapon:player.weapon});if(target){const damage=player.weapon===1?48:34;target.hp=Math.max(0,target.hp-damage);const died=target.hp===0;send(target.ws,'player_hit',{target:target.id,hp:target.hp,attacker:player.id,damage});if(died){target.deaths++;player.kills++;setTimeout(()=>{if(r.players.has(target.id)){target.hp=100;target.x=0;target.z=12.5;send(target.ws,'player_respawn',{hp:100,x:0,z:12.5});broadcast(r,'snapshot',{players:snapshot(r)})}},1800)}broadcast(r,'scoreboard',{kills:player.kills,deaths:player.deaths,board:snapshot(r)})}return}
    if(msg.type==='reload'){broadcast(r,'reload',{id:player.id});return}
  });
  ws.on('close',()=>{const player=clients.get(ws);if(player){const r=room();r.players.delete(player.id);clients.delete(ws);broadcast(r,'player_left',{id:player.id});if(!r.players.size&&r.interval){clearInterval(r.interval);r.interval=null;r.startedAt=0}}});
});
const stateBroadcast=setInterval(()=>{const r=room();if(r.players.size>1)broadcast(r,'snapshot',{players:snapshot(r)})},50);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.isAlive){ws.terminate();continue}ws.isAlive=false;ws.ping()}},30000);
server.listen(PORT,'0.0.0.0',()=>console.log(`TACTICAL OPS WebSocket listening on :${PORT}`));
process.on('SIGTERM',()=>{clearInterval(heartbeat);clearInterval(stateBroadcast);for(const r of rooms.values())if(r.interval)clearInterval(r.interval);server.close(()=>process.exit(0))});
