/* Maps active 2026 article records to preserved Demo Edition layouts without copying placeholders into Firestore. */
(function(){'use strict';
const W=window.Woonbi=window.Woonbi||{};
const links={
 'A-2026-001':'legacy-A01',
 'A-2026-002':'legacy-A02',
 'A-2026-003':'legacy-A04',
 'A-2026-004':'legacy-A05',
 'A-2026-005':'legacy-A06',
 'A-2026-006':'legacy-A07',
 'A-2026-007':'legacy-A08',
 'A-2026-008':'legacy-A09',
 'A-2026-010':'legacy-A12',
 'A-2026-013':'legacy-A13',
 'A-2026-014':'legacy-A16',
 'A-2026-015':'legacy-A17',
 'A-2026-017':'legacy-A20',
 'A-2026-018':'legacy-A22',
 'A-CURRENT-RB17C87AA6B02-EVENT':'legacy-A24',
 'A-2026-020':'legacy-A25',
 'A-2026-021':'legacy-A27',
 'A-2026-024':'legacy-A28'
};
function planFor(articleId){
 const legacyId=links[articleId];if(!legacyId)return null;
 const row=(W.newsroomData?.examples||[]).find(x=>x.id===legacyId);
 return row?{...row,legacyId}:null;
}
W.legacyArticleLinks=Object.freeze(links);
W.legacyPlanFor=planFor;
})();