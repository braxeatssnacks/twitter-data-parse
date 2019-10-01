const fs = require('fs');
const path = require('path');
const { createObjectCsvStringifier: createCsvStringifier } = require('csv-writer');
const request = require('request');

const prompt = question => new Promise((resolve) => {
  const { stdin, stdout } = process;

  stdin.resume();
  stdin.setEncoding('utf-8');
  stdout.write(`${question}\n`);

  stdin.once('data', (data) => {
    resolve((data.toString().trim()));
    stdin.pause();
  });
});

const UNSAFE_unpackTweets = (fpath) => {
  const tweetsFile = fs.readFileSync(fpath, 'utf8').toString();
  // `tweet.js` sets the following, so we need to prep the variables for handling & eval
  const window = {
    YTD: {
      tweet: {},
    }, };
  eval(tweetsFile);
  return window.YTD.tweet.part0;
};

/** Finesse username from the way that twitter resolves tweet ids
 * https://www.bram.us/2017/11/22/accessing-a-tweet-using-only-its-id-and-without-the-twitter-api/
 */
const requestTweet = ({ id, created_at, full_text, index }) => new Promise((resolve, reject) =>
  request(
    `http://www.twitter.com/random_person/status/${id}`,
    (err, resp) => {
      if (err || !resp) {
        return reject(err);
      }

      const tweetUsername = resp.request.uri.path.split(path.sep)[1].trim();
      const tweetUri = resp.request.uri.href;
      console.log(
        `[${index}] Resolving tweet from @${tweetUsername}: "${full_text}"`
      );
      return resolve({
        [COLUMNS.USERNAME]: tweetUsername,
        [COLUMNS.TWEET_URI]: tweetUri,
        [COLUMNS.DATE_CREATED]: created_at,
        [COLUMNS.TEXT]: full_text,
      });
    }
  ));

const MAX_RETRIES = 3;
const RETRY_INTERVAL_MS = 500;
const resolveTweetWithRetries = (tweet, retryCount = 0, retriesLeft = MAX_RETRIES, retryInterval = RETRY_INTERVAL_MS) => new Promise((resolve, reject) =>
  requestTweet(tweet)
    .then(resolve)
    .catch(err => {
      if (retriesLeft === 1) {
        return reject(`[${tweet.index}] Maximum retries exceeded`);
      }
      console.error(`[${tweet.index}] Attempt to retry${retryCount ? ` #${retryCount}` : ''} failed promise in ${retryInterval}ms...`, err.code);
      new Promise(r => setTimeout(r, retryInterval))
        .then(() => resolve(resolveTweetWithRetries(tweet, retryCount + 1, retriesLeft - 1)));
    })
);

const DEFAULT_FPATH = './tweet.js';
const COLUMNS = {
  USERNAME: 'username',
  TWEET_URI: 'uri',
  DATE_CREATED: 'created_at',
  TEXT: 'text',
};


const main = async () => {
  // const username = await prompt('What is your username? (exclude the @)') || 'braxeatssnacks';
  // const fpath = await prompt(`Where is the \`tweet.js\` export file? [${DEFAULT_FPATH}]`) || DEFAULT_FPATH;
  const username = 'braxeatssnacks';
  const fpath = DEFAULT_FPATH;

  const collection = UNSAFE_unpackTweets(fpath);

  const promises = [];
  for (let i = 0; i < 600; i++) {
    const tweet = collection[i];
    if (tweet.id) {
      promises.push(resolveTweetWithRetries({ ...tweet, index: i }));
    }
  }

  const resolvedTweets = await Promise.all(promises);

  const interactedTweets = []; // tweets favorited or liked
  const createdTweets = []; // tweets created
  resolvedTweets.forEach(tweet =>
    tweet.username === username ? createdTweets.push(tweet) : interactedTweets.push(tweet)
  );

  const csvWriter = createCsvStringifier({
    header: [
      { id: COLUMNS.USERNAME, title: 'Tweet author' },
      { id: COLUMNS.DATE_CREATED, title: 'Date created' },
      { id: COLUMNS.TWEET_URI, title: 'Tweet link' },
      { id: COLUMNS.TEXT, title: 'Text snippet' },
    ],
  });

  console.log(csvWriter.getHeaderString());
  console.log(csvWriter.stringifyRecords(createdTweets));
  // console.log(csvWriter.stringifyRecords(interactedTweets));
};

main();
