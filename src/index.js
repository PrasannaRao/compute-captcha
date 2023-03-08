import * as cookie from "cookie";

// This example uses Google reCAPTCHA V2.
// To start using reCAPTCHA, you need to register your domain at https://www.google.com/recaptcha/admin
// and get an API key pair. The key pair consists of a site key and a secret key.
const SITEKEY = "6Lctc-IkAAAAAHntBvKvSpPxyRr3XQo9p59-xtIe";
const SECRETKEY = "6Lctc-IkAAAAAM_Cei2xs-Wr85E43a3j4zUXQreo";
const PROTECTED_CONTENT =
  "<iframe src='https://developer.fastly.com/compute-welcome' style='border:0; position: absolute; top: 0; left: 0; width: 100%; height: 100%'></iframe>\n";
const CAPTCHA_FORM = `
<html>
  <head>
    <title>reCAPTCHA demo: Simple page</title>
    <script src="https://www.google.com/recaptcha/api.js" async defer></script>
  </head>
  <body>
    <form action="?captcha=true" method="POST">
      <div class="g-recaptcha" data-sitekey="${SITEKEY}"></div>
      <br/>
      <input type="submit" value="Submit">
    </form>
  </body>
</html>
`;

async function handleCaptchaRequest(req) {
  const body = await req.text();
  // Extract the user's response token from the POST body
  // and verify it with the reCAPTCHA API.
  const captcha = body.split("=")[1];
  const captchaURL = `https://www.google.com/recaptcha/api/siteverify?secret=${SECRETKEY}&response=${captcha}`;
  const captchaReq = new Request(captchaURL);
  const cacheOverride = new CacheOverride("pass");

  console.log("Sending to CAPTCHA API to verify");
  let res = await fetch(captchaReq, {
    backend: "captcha_backend_name",
    cacheOverride,
  });

  const result = await res.json();
  return result.success || false;
}

async function handleRequest(event) {
  let req = event.request;
  let url = new URL(req.url);
  const isChallenge = url.searchParams.has("captcha");

  if (req.method === "POST" && isChallenge) {
    const isPass = await handleCaptchaRequest(req);
    if (isPass) {
      // It's a pass! Set a cookie, so that this user is not challenged again within an hour.
      // You would probably want to make this cookie harder to fake.
      // If isPass is false, fall through to the remainder of the function and redisplay the CAPTCHA form.
      url.searchParams.delete("captcha");
      let headers = new Headers();
      headers.set("Cache-Control", "private, no-store");
      headers.set("Set-Cookie", "captchaAuth=1; path=/; max-age=3600");
      headers.set("Location", url);

      return new Response("", { status: 302, headers });
    }
  }

  let headers = new Headers();
  headers.set("Content-Type", "text/html; charset=utf-8");

  let body = CAPTCHA_FORM;
  if (req.headers.has("Cookie")) {
    const cookies = cookie.parse(req.headers.get("Cookie"));
    if (cookies.captchaAuth === "1") {
      body = PROTECTED_CONTENT;
    }
  }
  return new Response(body, { status: 200, headers });
}

addEventListener("fetch", (event) => event.respondWith(handleRequest(event)));