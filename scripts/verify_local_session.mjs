import { getLocalSessionFromCookie } from "../server/localAuth.ts";
import { getUserByOpenId } from "../server/db.ts";

const cookie = process.env.TEST_LOCAL_COOKIE;
const session = await getLocalSessionFromCookie(cookie);
const user = session ? await getUserByOpenId(session.openId) : null;
console.log(session && user ? `session_ok:${session.account.username}:${user.role}` : "session_or_user_missing");
