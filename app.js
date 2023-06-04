const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const format = require("date-fns/format");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//Authentication with JWT Token
const authencatUser = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(400);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", (error, payload) => {
      if (error) {
        response.status(400);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// Register user API
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const checkUserDbQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserDbQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const addUserQuery = `INSERT INTO 
            user (name, username, password, gender) 
            VALUES ('${name}', '${username}', '${hashedPassword}', '${gender}');`;
      await db.run(addUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

// Login user API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const checkUserDbQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserDbQuery);
  if (dbUser === undefined) {
    response.status("400");
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status("400");
      response.send("Invalid password");
    }
  }
});

// GET API 3
app.get("/user/tweets/feed/", authencatUser, async (request, response) => {
  const { username } = request;
  const checkUserDbQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserDbQuery);
  const getUserIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${dbUser.user_id};`;
  const dbGetUserIdsResult = await db.all(getUserIdsQuery);
  let idsList = [];
  for (let item of dbGetUserIdsResult) {
    idsList.push(item.following_user_id);
  }
  let idsToCheck = idsList.join(",");
  const tweetQuery = `SELECT
  user.username,
  tweet.tweet,
  tweet.date_time AS dateTime
  FROM user INNER JOIN tweet ON user.user_id = tweet.user_id
  WHERE tweet.user_id IN (${idsToCheck})
  ORDER BY date_time DESC LIMIT 4;`;
  const tweetQueryResult = await db.all(tweetQuery);
  response.send(tweetQueryResult);
});

// GET API 4
app.get("/user/following/", authencatUser, async (request, response) => {
  const { username } = request;
  const checkUserDbQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserDbQuery);
  const followersQuery = `SELECT user.name FROM 
  user INNER JOIN follower ON user.user_id = follower.following_user_id
  WHERE follower.follower_user_id = ${dbUser.user_id};`;
  const followerQueryResult = await db.all(followersQuery);
  response.send(followerQueryResult);
});

// GET API 5
app.get("/user/followers/", authencatUser, async (request, response) => {
  const { username } = request;
  const checkUserDbQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserDbQuery);
  const followersQuery = `SELECT user.name FROM 
  user INNER JOIN follower ON user.user_id = follower.follower_user_id
  WHERE follower.following_user_id = ${dbUser.user_id};`;
  const followerQueryResult = await db.all(followersQuery);
  response.send(followerQueryResult);
});

// GET API 6
app.get("/tweets/:tweetId/", authencatUser, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const checkUserDbQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserDbQuery);
  const getUserIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${dbUser.user_id};`;
  const dbGetUserIdsResult = await db.all(getUserIdsQuery);
  let idsList = [];
  for (let item of dbGetUserIdsResult) {
    idsList.push(item.following_user_id);
  }
  let idsToCheck = idsList.join(",");
  const tweetQuery = `SELECT
  tweet.tweet,
  COUNT(like.like_id) AS likes,
  COUNT(reply.reply_id) AS replies,
  tweet.date_time AS dateTime
  FROM (tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id) AS T
  INNER JOIN reply ON T.tweet_id = reply.tweet_id
  WHERE tweet.user_id IN (${idsToCheck}) AND tweet.tweet_id = ${tweetId}`;
  const tweetQueryResult = await db.get(tweetQuery);
  if (tweetQueryResult.tweet === null) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(tweetQueryResult);
  }
});

//GET API 7
app.get("/tweets/:tweetId/likes/", authencatUser, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const checkUserDbQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserDbQuery);
  const getUserIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${dbUser.user_id};`;
  const dbGetUserIdsResult = await db.all(getUserIdsQuery);
  let idsList = [];
  for (let item of dbGetUserIdsResult) {
    idsList.push(item.following_user_id);
  }
  let idsToCheck = idsList.join(",");
  const tweetQuery = `SELECT
  like.user_id AS id
  FROM (tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id) AS T
  INNER JOIN user ON T.user_id = user.user_id
  WHERE tweet.user_id IN (${idsToCheck}) AND tweet.tweet_id = ${tweetId}`;
  const tweetQueryResult = await db.all(tweetQuery);
  if (tweetQueryResult.length === 0) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    let likesId = [];
    for (let obj of tweetQueryResult) {
      likesId.push(obj.id);
    }
    likesId.sort();
    let likesIdCheck = likesId.join(",");
    const userNameQuery = `SELECT name FROM user WHERE user_id IN(${likesIdCheck});`;
    const userNameQueryResult = await db.all(userNameQuery);

    let likes = [];
    for (let obj of userNameQueryResult) {
      likes.push(obj.name);
    }
    response.send({ likes });
  }
});

//GET API 8
app.get(
  "/tweets/:tweetId/replies/",
  authencatUser,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const checkUserDbQuery = `SELECT * FROM user WHERE username = '${username}';`;
    const dbUser = await db.get(checkUserDbQuery);
    const getUserIdsQuery = `SELECT following_user_id FROM follower WHERE follower_user_id = ${dbUser.user_id};`;
    const dbGetUserIdsResult = await db.all(getUserIdsQuery);
    let idsList = [];
    for (let item of dbGetUserIdsResult) {
      idsList.push(item.following_user_id);
    }
    let idsToCheck = idsList.join(",");
    const tweetQuery = `SELECT
    (SELECT name FROM user WHERE user_id = reply.user_id) AS name,
    reply.reply
  FROM (tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id) AS T
  LEFT JOIN user ON T.user_id = user.user_id
  WHERE tweet.user_id IN (${idsToCheck}) AND tweet.tweet_id = ${tweetId};`;
    const tweetQueryResult = await db.all(tweetQuery);
    if (tweetQueryResult.length === 0) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      const replies = tweetQueryResult;
      response.send({ replies });
    }
  }
);

//GET API 9
app.get("/user/tweets/", authencatUser, async (request, response) => {
  const { username } = request;
  const checkUserDbQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserDbQuery);
  const tweetsQuery = `SELECT 
  tweet.tweet AS tweet,
  COUNT(like.like_id) AS likes,
  COUNT(reply.reply_id) AS replies,
  tweet.date_time AS dateTime
  FROM (tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id) AS T
  INNER JOIN reply ON T.tweet_id = reply.tweet_id
  WHERE tweet.user_id = ${dbUser.user_id};`;
  const tweetsQueryResult = await db.all(tweetsQuery);
  response.send(tweetsQueryResult);
});

//POST API 10
app.post("/user/tweets/", authencatUser, async (request, response) => {
  const { tweet } = request.body;
  const { username } = request;
  const checkUserDbQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserDbQuery);
  const dateTime = format(new Date(), "yyyy-MM-dd hh:mm:ss");
  const postTweet = `INSERT INTO tweet (tweet, user_id, date_time)
  VALUES ('${tweet}', ${dbUser.user_id}, '${dateTime}');`;
  const postTweetResult = await db.run(postTweet);
  response.send("Created a Tweet");
});

//DELETE APT 11
app.delete("/tweets/:tweetId/", authencatUser, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const checkUserDbQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(checkUserDbQuery);
  const tweetsDetails = `SELECT tweet_id FROM tweet WHERE user_id = ${dbUser.user_id};`;
  const tweetsDetailsResult = await db.all(tweetsDetails);
  const tweetsIds = [];
  for (let item of tweetsDetailsResult) {
    tweetsIds.push(item.tweet_id);
  }
  const tweetIdCheck = tweetsIds.includes(tweetId);
  if (tweetIdCheck === true) {
    const dbQuery = `DELETE FROM tweet WHERE tweet_id = ${tweetId};`;
    await db.run(dbQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
