require('dotenv-safe').load();
let ostb = require('os-toolbox');
let pm2 = require('pm2');

let statbot = require('server-statbot')({
  verify_token: process.env.FB_VERIFY_TOKEN,
  page_token: process.env.FB_PAGE_TOKEN,
  app_secret: process.env.FB_APP_SECRET,
  page_scoped_user_id: process.env.FB_USER_ID
});

pm2.connect(() => {
  pm2.launchBus((err, bus) => {
    bus.on('log:out', packet => {
      statbot.say('[' + packet.process.name + '] ' + packet.data.replace('\\n', '\n'));
    });
    bus.on('log:err', packet => {
      statbot.say('[' + packet.process.name + '][err] ' + packet.data.replace('\\n', '\n'));
    });
  });
});

statbot.hears(["status"], (text, reply) => {
  reply("Uptime: " + ostb.uptime() + "s");
  ostb.cpuLoad().then(function(cpuusage){
    reply("CPU: " + cpuusage + "%");
  });
  ostb.memoryUsage().then(function(memusage){
    reply("Memory: " + cpuusage + "%");
  });
});

statbot.listen(process.env.PORT);
