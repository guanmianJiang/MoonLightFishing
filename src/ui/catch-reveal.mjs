// Presentation only: no rewards, decisions or save fields are created here.
export function catchRevealPresentation(caught,fish,label='') {
 const grade=['S','A','B','C'].includes(caught?.fightReport?.grade)?caught.fightReport.grade:'';
 if(fish?.object)return {title:'收获一份意外',mood:'discovery',grade:''};
 if(caught?.tagId)return {title:'老朋友回来了',mood:'reunion',grade};
 if(fish?.special)return {title:'遇见特别来客',mood:'special',grade};
 if(label==='首次记录')return {title:'新朋友上岸',mood:'first',grade};
 if(label==='重量纪录')return {title:'这一尾，有分量',mood:'record',grade};
 return {title:'钓获上岸',mood:'catch',grade};
}
