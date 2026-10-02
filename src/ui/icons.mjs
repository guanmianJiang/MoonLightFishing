// Small shared SVGs keep touch controls crisp at every viewport width.
const paths={
 release:'<path d="M5 9c3-4 9-4 13 0-4 4-10 4-13 0ZM5 9 2 6v6l3-3Z"/><circle cx="15" cy="8" r=".6" fill="currentColor"/><path d="M3 17q3-2 6 0t6 0t6 0M5 21q3-2 6 0t6 0"/>',
 basket:'<path d="m3 10 3 11h12l3-11H3ZM7 10l3-7m7 7-3-7M9 14v4m6-4v4"/>',
 keep:'<path d="M4 5h16v16H4zM8 2v6m8-6v6m-4 3 1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5Z"/>',
 study:'<path d="M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2V3ZM5 17h14M9 7h6m-6 4h4"/><path d="m14 14 6-6 2 2-6 6-3 1Z"/>',
 water:'<path d="M3 6q3-3 6 0t6 0t6 0M3 12q3-3 6 0t6 0t6 0M3 18q3-3 6 0t6 0t6 0"/>',
 collection:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
 clues:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M8 10h4m-2-2v4"/>',
 gear:'<path d="M5 21 15 3q4 0 5 4v8a3 3 0 0 1-6 0v-2M8 17l3 2M6 20l3 2"/>',
 shop:'<path d="M4 9v12h16V9M3 9l2-6h14l2 6M9 21v-7h6v7M3 9q2 3 4 0 2 3 5 0 3 3 5 0 2 3 4 0"/>',
 weight:'<path d="M5 8h14l2 13H3L5 8Z"/><circle cx="12" cy="5" r="3"/>',
 length:'<path d="M3 8h18v9H3zM7 8v4m4-4v6m4-6v4m3-4v6"/>',
 medal:'<circle cx="12" cy="9" r="5"/><path d="m9 14-2 7 5-2 5 2-2-7"/>',
 target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
 cast:'<path d="M4 21 14 3q7 1 7 7M14 3l3 9v5a3 3 0 0 1-6 0m-4 0 4 2"/>',
 back:'<path d="m10 5-7 7 7 7M3 12h18"/>',
 chevron:'<path d="m8 5 7 7-7 7"/>',
};

export function uiIcon(id){
 return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[id]||paths.study}</svg>`;
}
