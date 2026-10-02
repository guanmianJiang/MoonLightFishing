const clamp01=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;

export function reelLeverPose(scale=1,angle=0){
 const reach=Number.isFinite(scale)?Math.max(0,Math.min(42,(scale-1)*21)):0;
 const radians=Number.isFinite(angle)?angle*Math.PI/180:0;
 return {x:Math.round(Math.cos(radians)*reach*10)/10,y:Math.round(Math.sin(radians)*reach*10)/10};
}

export function reelControlFeedback({mode='reel',fight,held=false,paying=false,lifted=false,ready=false,critical=false,gesture=null}={}){
 const load=clamp01(fight?.load??fight?.tension);
 const slack=clamp01(fight?.slack);
 const danger=mode==='reel'&&(critical||load>.68)&&slack<.45;
 const canLift=ready&&slack<.45;
 const cue=mode!=='reel'?'hold':paying?'payout':lifted?'return':danger?'release':canLift?'lift':'hold';
 const caption=mode==='retrieve'?'点按收回':mode==='strike'?'按住提竿':paying?'下压让线':lifted?'滑回收线':danger?'松手让线':canLift?'上提抬竿':held?'正在收线':'按住收线';
 const hint=mode==='retrieve'?'钩上挂了东西\n点一下收回':mode==='strike'?'鱼已咬稳\n按住后继续收线':paying?'正在让线\n滑回中位继续收线':lifted?'抬竿正在拉近\n滑回中位继续收线':danger?'鱼线绷紧了\n下压或松手让线':slack>=.45?'鱼线松了\n按住收紧鱼线':canLift?'鱼放缓了\n上提抬竿拉近':fight?.fishState==='hookset'?'先按住收紧鱼线\n留意竿弯的变化':held?'鱼放缓时上提\n线紧时下压让线':'按住线轮持续收线\n线紧时下压让线';
 const turns=Number.isFinite(fight?.reelTurns)?Math.max(0,fight.reelTurns):0;
 const dx=Number.isFinite(gesture?.dx)?gesture.dx:0;
 const dy=Number.isFinite(gesture?.dy)?gesture.dy:0;
 return {
  cue,caption,hint,showDirections:mode==='reel',danger,loadState:slack>=.45?'slack':danger?'danger':'steady',
  tensionDash:mode==='reel'?`${Math.round(load*(1-slack)*75)} 100`:'0 100',
  spoolAngle:`${Math.round(turns*40)}deg`,
  rodTilt:`${Math.round(Math.max(-16,Math.min(16,dx*.16-dy*.06)))}deg`
 };
}
