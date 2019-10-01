twitters data export sucks and doesn't distinguish between tweets that you've created versus tweets that you've interacted with.

We're going to finesse a separation of the two and subsequently dump each of those into separate CSV's for better readability and clarity.

```
npm install
npm run start
```

This program will prompt you for two things:
1. your twitter handle
2. the local filepath of your `tweet.js` file from the twitter data export


##### Callouts
* currently timeouts on large datasets &mdash; #1
