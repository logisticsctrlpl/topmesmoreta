const axios = require('axios');
const uniqid = require('uniqid');
const rateLimit = require('axios-rate-limit');
const crypto = require('crypto');
const fs = require('fs');

const userAgent = "a4b471be-4ad2-47e2-ba0e-e1f2aa04bff9";
let baseCookie = "new_SiteId=cod; ACT_SSO_LOCALE=en_US;country=US;XSRF-TOKEN=68e8b62e-1d9d-4ce1-b93f-cbe5ff31a041;API_CSRF_TOKEN=68e8b62e-1d9d-4ce1-b93f-cbe5ff31a041;";
let ssoCookie;
let loggedIn = false;
let debug = 0;

let apiAxios = axios.create({
    headers: {
        common: {
            "content-type": "application/json",
            "Cookie": baseCookie,
            "userAgent": userAgent,
            "x-requested-with": userAgent,
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "Connection": "keep-alive"
        },
    }
});

console.log("[-] Initialized axios API");

let loginAxios = apiAxios;
let defaultBaseURL = "https://my.callofduty.com/api/papi-client/";
let loginURL = "https://profile.callofduty.com/cod/mapp/";
let defaultProfileURL = "https://profile.callofduty.com/";

class helpers {
    buildUri(str) {
        return `${defaultBaseURL}${str}`;
    }

    buildProfileUri(str) {
        return `${defaultProfileURL}${str}`;
    }

    cleanClientName(gamertag) {
        return encodeURIComponent(gamertag);
    }

    postReq(url, data, headers = null) {
        return new Promise((resolve, reject) => {
            loginAxios.post(url, data, headers).then(response => {
                resolve(response.data);
            }).catch((error) => {
                console;error(error);
                console.error("[x] Couldn't login w provided account");
            });
        });
    }
}

var _helpers = new helpers();

var email = "cosuwo@givmail.com";
var pwd = "Testcodstats1";

var gamerTag = "GGHardass#3765";
var platform = "battle";
var lookupType = "gamer";

var compiledData = {
    "wins" : 0,
    "kdratio": 0.0,
    "kills": 0,
    "teamwipes": 0
}

console.log("[-] Initialized Helpers");

var cleanGamerTag = _helpers.cleanClientName(gamerTag);

var start = 0;
var end = 0;

let randomId = uniqid();
let md5sum = crypto.createHash('md5');
let deviceId = md5sum.update(randomId).digest('hex');
_helpers.postReq(`${loginURL}registerDevice`, {
    'deviceId': deviceId
}).then((response) => {
    let authHeader = response.data.authHeader;
    apiAxios.defaults.headers.common.Authorization = `bearer ${authHeader}`;
    apiAxios.defaults.headers.common.x_cod_device_id = `${deviceId}`;
    _helpers.postReq(`${loginURL}login`, {
        "email": email,
        "password": pwd
    }).then((data) => {
        if (!data.success) throw Error("401 - Unauthorized. Incorrect username or password.");
        ssoCookie = data.s_ACT_SSO_COOKIE;
        apiAxios.defaults.headers.common.Cookie = `${baseCookie}rtkn=${data.rtkn};ACT_SSO_COOKIE=${data.s_ACT_SSO_COOKIE};atkn=${data.atkn};`;
        loggedIn = true;

        console.log("[-] Login successful");

        const timer = ms => new Promise( res => setTimeout(res, ms));
        (async function(){
         while (1) {
            var fileName = "data-" + new Date().getTime() + ".txt";
            var d = new Date();
            d.setDate(d.getDate() - 1);
            start = d.getTime();
            end = 0;

            console.log("[-] Retrieving data - Date : " + new Date().toISOString());

            var retrievedDate = await retrieveStats(start, end, fileName);

            while (retrievedDate > start) {
                console.log("[-] Matches list exceeded 20 entries. Querying next batch...");
                end = retrievedDate;
                retrievedDate = await retrieveStats(start, end, fileName);
            }

            try {
                console.log("[-] Retrieved data successfully. Dumping to respective files...")
                fs.writeFileSync("wins.txt", compiledData.wins.toString());
                fs.writeFileSync("kills.txt", compiledData.kills.toString());
                fs.writeFileSync("kdratio.txt", compiledData.kdratio.toString());
                fs.writeFileSync("teamwipes.txt", compiledData.teamwipes.toString());
              } catch (err) {
                console.error("[x] Couldn't write to data file");
                console.error(err)
              }

                console.log("[-] Wrote data to file successfully");
                console.log("[/] Waiting for 30 mins for next data dump...");

                compiledData = {
                    "wins" : 0,
                    "kdratio": 0.0,
                    "kills": 0,
                    "teamwipes": 0
                };

                await timer(1000 * 60 * 30);
            }
        })()


    }).catch((err) => {
        console.error("[x] Login denied - Check email and password");
        console.log(err.message);
    });
}).catch((err) => {
    console.error("[x] Login issue")
    console.error(err.message);
});

async function retrieveStats(start, end) {
    console.log("[-] Building stats request");

    var endpoint = _helpers.buildUri(`crm/cod/v2/title/mw/platform/${platform}/${lookupType}/${cleanGamerTag}/matches/wz/start/${start}/end/${end}/details`);

    await apiAxios.get(endpoint, { params: { limit: 20 } })
    .then(response => {
         if (response.data == undefined || response.data.data == undefined || response.data.data.summary == undefined)
            return undefined;

         compiledData.kills += response.data.data.summary.all.kills;
         if (compiledData.kdratio != 0)
            compiledData.kdratio =  (compiledData.kdratio + response.data.data.summary.all.kdRatio) / 2;
        else
            compiledData.kdratio = response.data.data.summary.all.kdRatio;
        
        compiledData.kdratio = parseFloat(compiledData.kdratio.toFixed(2));
        
        compiledData.teamwipes += (response.data.data.summary.all.objectiveTeamWiped  != undefined) ? response.data.data.summary.all.objectiveTeamWiped : 0;

        for (var i=0; i < response.data.data.matches.length; i++) {

            console.log("[-] Retrieved match with date : " + new Date(response.data.data.matches[i].utcStartSeconds * 1000).toLocaleDateString("en-US"));

            compiledData.wins += (response.data.data.matches[i].playerStats.teamPlacement == 1) ? 1 : 0;
        }

        return response.data.data.matches[response.data.data.matches.length - 1].utcStartSeconds * 1000;
         
        },
        error => { console.error(error);});
}