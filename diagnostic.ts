import http from "http";

const req = http.request({
  host: "localhost",
  port: 3000,
  path: "/api/public/db-diagnostics",
  method: "GET"
}, (res) => {
  console.log("STATUS:", res.statusCode);
  let data = "";
  res.on("data", (chunk) => { data += chunk; });
  res.on("end", () => {
    console.log("BODY:", data);
  });
});

req.on("error", (e) => {
  console.error(`ERROR: ${e.message}`);
});

req.end();
