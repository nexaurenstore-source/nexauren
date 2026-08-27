const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store',...extra}});

async function scalar(db,sql,...args){const row=await db.prepare(sql).bind(...args).first();return Number(row?.total||0)}

async function dashboard(r,e){
  const now=Math.floor(Date.now()/1000),week=now-604800;
  const [users,newUsers,active,forms,responses,reviews,notifications]=await Promise.all([
    scalar(e.DB,'SELECT COUNT(*) AS total FROM users'),
    scalar(e.DB,'SELECT COUNT(*) AS total FROM users WHERE created_at>=?1',week),
    scalar(e.DB,'SELECT COUNT(DISTINCT user_id) AS total FROM sessions WHERE expires_at>?1',now),
    scalar(e.DB,'SELECT COUNT(*) AS total FROM forms'),
    scalar(e.DB,'SELECT COUNT(*) AS total FROM form_responses'),
    scalar(e.DB,'SELECT COUNT(*) AS total FROM tool_reviews'),
    scalar(e.DB,'SELECT COUNT(*) AS total FROM notifications')
  ]);
  return json({users,new_users:newUsers,active_users:active,forms,responses,reviews,notifications},200);
}

async function users(r,e){
  const u=new URL(r.url),page=Math.max(1,Number(u.searchParams.get('page'))||1),limit=Math.max(1,Math.min(100,Number(u.searchParams.get('limit'))||25)),offset=(page-1)*limit;
  const [total,rows]=await Promise.all([
    scalar(e.DB,'SELECT COUNT(*) AS total FROM users'),
    e.DB.prepare('SELECT u.id,u.email,u.username,u.created_at,u.updated_at,COALESCE(p.xp,0) AS xp,COALESCE(p.level,1) AS level FROM users u LEFT JOIN user_progress p ON p.user_id=u.id ORDER BY u.created_at DESC LIMIT ?1 OFFSET ?2').bind(limit,offset).all()
  ]);
  return json({total,page,limit,users:rows?.results||[]},200);
}

async function recentLogins(r,e){
  const u=new URL(r.url),limit=Math.max(1,Math.min(100,Number(u.searchParams.get('limit'))||25));
  const rows=await e.DB.prepare('SELECT s.created_at,s.expires_at,u.id AS user_id,u.email,u.username FROM sessions s JOIN users u ON u.id=s.user_id ORDER BY s.created_at DESC LIMIT ?1').bind(limit).all();
  return json({activity:rows?.results||[]},200);
}

export async function adminApi(r,e){
  const path=new URL(r.url).pathname;
  if(path==='/api/admin/dashboard'&&r.method==='GET')return dashboard(r,e);
  if(path==='/api/admin/users'&&r.method==='GET')return users(r,e);
  if(path==='/api/admin/activity'&&r.method==='GET')return recentLogins(r,e);
  return json({error:'Admin route not found.'},404);
}
