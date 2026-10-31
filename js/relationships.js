// 原始文件記載與家族明確補充均可成為關係證據；待考證關係不參與親子排版。
export function isConfirmedRelationship(relation) {
  return ['source-supported', 'user-confirmed'].includes(relation.status);
}
