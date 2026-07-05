import http from "http";

const postData = JSON.stringify({ targetUserId: "test_uid" });

const req = http.request({
  host: "localhost",
  port: 3000,
  path: "/api/admin/delete-user",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(postData)
  }
}, (res) => {
  console.log("STATUS:", res.statusCode);
  console.log("HEADERS:", JSON.stringify(res.headers));
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    console.log("BODY:", data);
  });
});

req.on("error", (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.write(postData);
req.end();
