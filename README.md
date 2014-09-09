# SlackIRC

#### _Make Slack work as an IRC client_
* * *

This little server attempts to be a two-way bridge between Slack and IRC. The idea is that you
can do

`/ircsetup ssl=true server=myircserver.com:6697 server=myserverpassword channel=#myircchannel`

in a Slack channel, and it will set up the connection.

### Integration setup

For this service to work, we depend on various Slack integrations.

#### Slack API

Go to [Slack API](https://api.slack.com) after you log in to your Slack account, and generate
a bearer token for your team (if you haven't done so already).

#### Slack Integrations

Go to [Slack Integrations](https://my.slack.com/services) for your team and add Slash Commands
and Outgoing WebHooks.

For the Slash Commands integration, set the Command to `/ircsetup`, URL to
`https://<yourserver.com>/ircsetup`, and Method to `POST`.

For Outgoing WebHooks - this is a little annoying - but Slack only supports having one per
channel (otherwise you would have to use specific keywords to trigger it). This means that you
will have to add one for each Slack channel you want to link with an IRC channel. Anyway...
after you add it, in the **Integration Settings** section, set Channel to your desired Slack
channel, let Trigger words be empty, and set URL to `https://<yourserver.com>/toirc`.

So if you have multiple Slack channels, just repeat the procedure for each of them...

### SlackIRC installation

There is a default config file in `config/default.yml`. It is lightly commented - copy it to
`config/local.yml` and put overrides in that file (so you easily avoid checking it in to git).

Do `npm install` to get your dependencies.

Run it with `node server.js`

Type an `/ircsetup` command and pray you get a `Setup successful` message back ;)
