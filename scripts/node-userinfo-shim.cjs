// Some restricted Windows runners deny uv_os_get_passwd even though USERNAME
// is available. Keep local tooling such as tsx operational in that environment.
const os = require("node:os");

try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    uid: -1,
    gid: -1,
    username: process.env.USERNAME || "local-user",
    homedir: process.env.USERPROFILE || process.cwd(),
    shell: null,
  });
}
