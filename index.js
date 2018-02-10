require('dotenv-safe').load();
let ostb = require('os-toolbox');
let pm2 = require('pm2');
let Tail = require('tail').Tail;

let Statbot = require('server-statbot');
let statbot = Statbot({
  verify_token: process.env.FB_VERIFY_TOKEN,
  page_token: process.env.FB_PAGE_TOKEN,
  app_secret: process.env.FB_APP_SECRET,
  page_scoped_user_id: process.env.FB_USER_ID
});

statbot.controller.api.messenger_profile.menu([{
  locale: "default",
  call_to_actions: [{
    type: "postback",
    title: "Status",
    payload: "status"
  }]
}]);

// On every sshd log, message me
statbot.use(Statbot.logtail('/var/log/secure', {
  transform: function(line){
    const matchers = [
      /Did not receive identification string from [0-9\.]+/,
      /Bad protocol version identification/,
      /Disconnected from [0-9\.]+ port [0-9]+ \[preauth\]/,
      /Received disconnect from [0-9\.]+/,
      /Connection closed by [0-9\.]+ (port [0-9]+ )?\[preauth\]/,
      /Disconnecting: Too many authentication failures (for [a-zA-Z0-9\-\_\.]* )?\[preauth\]/,
      /Disconnecting: Change of username or service not allowed: \([a-zA-Z0-9\-\_\.]*,ssh\-connection\) \-\> \([a-zA-Z0-9\-\_\.]*,ssh\-connection\) \[preauth\]/,
      /input_userauth_request: invalid user [a-zA-Z0-9\-\_\. ]* \[preauth\]/,
      /Invalid user +[^ ]+ +from [0-9\.]+/,
      /fatal: Read from socket failed: Connection reset by peer \[preauth\]/,
      /fatal: Write failed: Connection reset by peer \[preauth\]/,
      /error: maximum authentication attempts exceeded for (invalid user )?[a-zA-Z0-9\-\_\.]* from [0-9\.]+ port [0-9]+/,
      /Connection reset by [0-9\.]+ port [0-9]+ \[preauth\]/,
      /POSSIBLE BREAK-IN ATTEMPT\!/,
    ];
    
    for(var i = 0; i < matchers.length; i++){
      if(matchers[i].test(line))
        return null;
    }
    return line;
  }
}));


statbot.hears("statbot", ["mutelist"], (text, reply) => {
  reply(Array.from(statbot.mutelist).join(' '));
});

statbot.hears("statbot", ["unmute"], (text, reply) => {
  if(text.slice(0, 7).toLowerCase() == 'unmute '){
    let exclusion = text.slice(7).trim();
    let wasMuted = statbot.unmute(exclusion);
    if(wasMuted)
      reply("Removed '" + exclusion + "' from channel mute list");
    else
      reply("'" + exclusion + "' was not on the channel mute list anyway");
  }
});

statbot.hears("statbot", ["mute"], (text, reply) => {
  if(text.slice(0, 5).toLowerCase() == 'mute '){
    let exclusion = text.slice(5).trim();
    statbot.mute(exclusion);
    reply("Added '" + exclusion + "' to channel mute list");
  }
});


// On every log output from pm2, message me
process.env.PM2_HOME = '/home/ec2-user/.pm2';
pm2.connect(() => {
  pm2.launchBus((err, bus) => {
    bus.on('log:out', packet => { statbot.say(packet.process.name, packet.data); });
    bus.on('log:err', packet => { statbot.say(packet.process.name + ' err', packet.data); });
  });
});

statbot.hears("statbot", ["proc restart"], (text, reply) => {
  if(text.slice(0, 13).toLowerCase() == 'proc restart '){
    let proc = text.slice(13);
    pm2.restart(proc, (err) => {
      if(err) reply("Failed to restart " + proc);
      else reply("Successfully restarted " + proc);
    });
  }
});

// Requesting general status of the server
statbot.hears("statbot", ["status"], (text, reply) => {
  reply("Uptime: " + ostb.uptime() + "s");
  
  ostb.cpuLoad().then(cpuusage => {
    reply("CPU: " + cpuusage + "%");
  }).catch(err => {
    reply("Unable to get CPU usage: " + err);
  });
  
  ostb.memoryUsage().then(memusage => {
    reply("Memory: " + memusage + "%");
  }).catch(err => {
    reply("Unable to get memory usage: " + err);
  });
  
  pm2.list((err, procs) => {
    if(err)
      console.error("Could not fetch PM2 process list:", err);
    else
      reply(procs.map(proc => proc.name + ' up ' + (new Date().getTime() - proc.pm2_env.pm_uptime)/1000 + 's').join('\n'));
  });
});

statbot.listen(process.env.PORT, function(err){
  if(err)
    console.log('error starting statbot');
  else
    console.log('running on port ' + process.env.PORT);
});
