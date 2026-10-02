# 图鉴手记成果与行动引导

日期：2026-10-02。依据HANDOFF个人水域探索方向、已有discovery-notes/spot-chronicle、ui-material V2和responsive-ui。

## 目标与结构

手记默认水域入口先展示成果总览、最近相遇、下一次可执行观察；详细水域数据收进原生details。主导航为手记/图鉴/收藏，鱼口技巧/钓组/鱼篓/鱼市为次级折叠入口，旧功能继续可达，不新增经营循环。图鉴与占用位置的个人收藏明确分开，收藏放回后仍可从既有日志/履历回看相遇。

## 数据与接口

`journalAchievements(save)`纯派生：从既有log、collection、tracked、fightRecords、规范化waterChronicle读取已遇鱼种/沉水物、可验证重量纪录和地点；仅认可catalog ID。重复来源不重复增加种类，未知/非法项忽略；没有重量不编造纪录。不把pending未结算catch作为成果。bounded log截断无法补全旧史，界面说明仅回看现有保存证据，不宣称新增长期完整图鉴存档。

观察成果复用discoveryJournal，区分seen/hypothesis/supported；总结“观察获支持”只计supported，不把猜测当事实。水域可访问数复用spotUnlocked，探索进度不重算业务规则。最近相遇取现有log的前三个有效项，无时间戳不显示日期。

`renderJournalOverview(save,thumb)`、`renderEncounterAtlas(save,thumb)`输出转义后的HTML。只给已遇项目请求现有缩略图，未遇项目使用矢量占位且不提前展示名称/描述。已遇卡片用details展开生态说明、已有最大重量、真实地点与最佳搏鱼纪录；没有证据显示缺项。按钮data-book-page仅切到白名单页面；data-prepare-spot复用原安全准备逻辑，pending存在时不显示下一竿准备按钮，禁止隐式抛竿/换点。

Solid导航update(tab,counts)同步主动页与已有成果计数，未知tab回water，保留aria-current/pressed；折叠入口用原生summary触控，无hover依赖。图鉴/overview不会修改存档、追踪、生态或发放进度。收藏与旧处理入口保留。

## 视觉与边界

去掉标题装饰图，三项主导航单行；成果层3列、小屏保持minmax(0,1fr)，图鉴两列图文卡，详情不另开嵌套模态。正文与展开内容在bookContent内部滚动，沿用可视键盘高度和安全区。图标与小字不能遮住真实按钮；触控入口≥44px。主建议用温暖的主动作，次级导航与细项维持轻材质，不叠加持续特效。

## 验证

Node覆盖新/旧/缺失存档、多个来源去重、未知ID、非有限重量、未结算成果排除、发现状态计数、阅读不改档、缩略图不泄露未知种、HTML转义、pending不出准备入口、页面切换白名单与原准备动作回归；CSS与Solid构建核对。更新IMPLEMENTED，报告全量/构建结果。沿用用户要求不进游戏、不用Computer Use；实际阅读层级/长文字/真机触控仍待验。
