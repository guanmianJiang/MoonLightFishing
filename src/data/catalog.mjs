// Authoritative content catalog. Keep stable IDs for saved games and assets.
export const SPOTS=[
 {id:'reed',name:'近岸浅滩',depth:'1.2m',x:40,y:42,unlock:0,chapter:'第一站 · 近岸'},
 {id:'bridge',name:'栈桥外湾',depth:'2.8m',x:54,y:57,unlock:3,chapter:'第二站 · 外湾'},
 {id:'deep',name:'外海深水',depth:'6.4m',x:73,y:67,unlock:7,chapter:'第三站 · 外海'}
];
export const BAITS=[
 {id:'grain',name:'麦粒',desc:'浮水 · 鲫鱼 / 白条',effect:'落水轻，主要吸引浅层小鱼。',symbol:'⁙'},
 {id:'worm',name:'蚯蚓',desc:'沉底 · 鲈鱼 / 鲶鱼',effect:'气味能沉到水底，更容易引来鲈鱼和鲶鱼。',symbol:'〰'},
 {id:'glow',name:'夜光虫',desc:'微光 · 河虾 / 异常目标',effect:'水下微光会吸引河虾，也可能引来异常目标。',symbol:'✧'}
];
export const FISH=[
{id:'carp',name:'银背鲫',art:0,min:.12,max:1.8,length:24,desc:'常见的浅水鱼，体重跨度很大，放流后容易形成稳定鱼群。'},
{id:'minnow',name:'细鳞白条',art:1,min:.025,max:.18,length:13,desc:'成群活动的小鱼。数量增加后，会把红鳍鲈引到岸边。'},
{id:'shrimp',name:'青壳河虾',art:2,min:.008,max:.06,length:7,desc:'生活在水草和石缝附近，是底层鱼的重要食物。'},
{id:'perch',name:'红鳍鲈',art:3,min:.3,max:2.8,length:31,desc:'追食型鱼类，常从侧面突然冲向移动的鱼饵。'},
{id:'catfish',name:'岩底鲶',art:4,min:1.2,max:7.6,length:62,desc:'长期贴底活动，咬钩时通常先把松线缓慢拖向深处。'},
{id:'bottle',name:'旧漂流瓶',art:5,min:.2,max:.4,length:18,desc:'瓶身已经磨花，里面夹着一张提到“断尾大鱼”的旧纸条。',object:true},
{id:'oldgold',name:'断尾金鲤',art:6,min:8.2,max:12.6,length:85,desc:'栈桥附近的巨型金鲤，尾鳍有明显缺口，警惕性很高。',special:true},
{id:'moon',name:'银月鱼',art:7,min:2.1,max:4.6,length:51,desc:'鳞片能强烈反射水面光线，目前只在晴天深水区有记录。',special:true},
{id:'bell',name:'沉水铜铃',art:8,min:.13,max:.3,length:9,desc:'从栈桥水底拉起的铜铃，内部仍能发出声音。',object:true}
];
export const GEAR={
 rod:[{id:'willow',name:'轻型竿',unlock:0,desc:'适合浅水和小型鱼。'},{id:'tide',name:'加固竿',unlock:4,desc:'提高大型个体的重量区间。'}],
 reel:[{id:'wood',name:'基础线轮',unlock:0,desc:'标准收线速度，没有额外修正。'},{id:'patient',name:'慢速线轮',unlock:3,desc:'延长试探阶段，方便判断谨慎鱼口。'}],
 line:[{id:'linen',name:'普通钓线',unlock:0,desc:'适合识别常见鱼口。'},{id:'copper',name:'铜芯感应线',unlock:5,desc:'提高沉水物和底层目标的出现率。'}],
 float:[{id:'cork',name:'软木漂',unlock:0,desc:'显示常见啄口和拖线。'},{id:'mirror',name:'反光漂',unlock:7,desc:'能触发深水区的异常目标。'}]
};
export const PROCESS_ACTIONS=[
 {id:'basket',name:'放入鱼篓',desc:'带去鱼市出售，换金币升级装备'},
 {id:'keep',name:'收进收藏',desc:'占用一个收藏位，鱼会离开当前水域'},
 {id:'release',name:'放回水里',desc:'提高同类活跃度，影响下一轮鱼群'},
 {id:'study',name:'做成记录',desc:'不保留实物，增加调查进度并解锁内容'}
];
export const TRIP_GOALS=[
 {id:'study2',name:'完成 2 次记录',desc:'用两次钓获换取调查进度',action:'study',target:2,reward:1},
 {id:'release2',name:'放回 2 个活体',desc:'观察放流对下一轮鱼群的影响',action:'release',target:2,reward:1},
 {id:'keep2',name:'收藏 2 个样本',desc:'在有限收藏位中做取舍',action:'keep',target:2,reward:1}
];

export const TRIP_RULES=[
 {id:'shoal',name:'浅滩鱼群集中',desc:'浅滩更容易钓到鲫鱼和白条；放流活体对后续抛竿的影响更强。'},
 {id:'bottom',name:'底层水体翻动',desc:'虾、鲶鱼和沉水物更容易出现；记录沉水物或特殊特征时额外获得 1 点调查进度。'},
 {id:'predator',name:'捕食鱼活跃',desc:'红鳍鲈和岩底鲶出现率提高；收藏这两类鱼会明显降低后续出现率。'}
];

export const CLUES={reed:'白条会追麦粒；栈桥外湾同时出现了更大的水声。',gold1:'栈桥木桩旁发现大型金色鱼影，尾鳍有缺口。',gold2:'该个体只在雨后接近浮水饵，而且容易被动作惊走。',moon1:'晴天深水区发现银色鱼影，会靠近发光鱼饵。',moon2:'银色个体会检查夜光虫，但目前还缺少稳定的提竿时机记录。'};
export const TACTICS=[
 {id:'wait',name:'先别动',desc:'鱼影绕着浮漂，或浮漂移动后停住'},
 {id:'tease',name:'轻提鱼饵',desc:'浮漂连续轻点，鱼在追着鱼饵游'},
 {id:'shorten',name:'收紧半圈',desc:'鱼线松着，正慢慢向深水偏移'}
];
export const SIGNALS={
 dart:{name:'追饵',tactic:'tease',observe:'窄鱼影快速转向，浮漂连续轻点两次。',success:'轻提后鱼影立即回头追饵，拉力正在变实。记录：追饵型。',fail:'提竿动作没有配合鱼口，目标已离开。'},
 deep:{name:'贴底拖线',tactic:'shorten',observe:'水底冒出大气泡，松线缓慢向深处偏移。',success:'收紧半圈后竿尖开始下压，拉力仍在增加。记录：贴底重型目标。',fail:'松线没有及时收紧，目标已经脱离鱼饵。'},
 broad:{name:'谨慎试饵',tactic:'wait',observe:'宽鱼影绕浮漂一圈，没有立即咬钩。',success:'保持不动后浮漂开始缓慢下沉。记录：高警惕目标。',fail:'鱼饵移动后，宽鱼影退回桥柱附近。'},
 peck:{name:'连续啄食',tactic:'tease',observe:'浮漂连续小幅抖动，鱼饵附近有一串小气泡。',success:'轻提鱼饵后，零散啄口开始转为持续拉力。',fail:'鱼饵动作过大，气泡和鱼口同时消失。'},
 steady:{name:'横向带线',tactic:'wait',observe:'浮漂横向移动一小段，然后停住。',success:'保持不动后浮漂再次下沉，拉力正在变实。',fail:'提前操作后，鱼线恢复松弛，目标已经离开。'}
};

export const SHOP=[
 {id:'rod',name:'钓竿',description:'扩大可承受的鱼重，拉鱼时更稳。',prices:[120,280,480,760],levels:['轻竹钓竿','加固钓竿','碳素钓竿','潮汐钓竿','深海钓竿']},
 {id:'reel',name:'线轮',description:'提高收线效率，缩短搏鱼时间。',prices:[120,260,450,700],levels:['手动线轮','顺滑线轮','精密线轮','远投线轮','大师线轮']},
 {id:'float',name:'鱼漂',description:'增加珍稀鱼的出现机会。',prices:[150,300,520,800],levels:['羽毛鱼漂','夜光鱼漂','灵敏鱼漂','星辉鱼漂','月光鱼漂']},
 {id:'line',name:'鱼线',description:'扩大安全区，减缓张力积累。',prices:[110,250,430,680],levels:['棉纺鱼线','尼龙鱼线','编织鱼线','铜芯鱼线','深海鱼线']}
];

export const WEATHERS=[
 {id:'mist',name:'晨雾',hint:'能见度较低，浅滩的小鱼活动更明显。'},
 {id:'rain',name:'雨后',hint:'栈桥外湾出现了较宽的水纹。'},
 {id:'moon',name:'晴天',hint:'深水区出现了强烈的银色反光。'}
];
