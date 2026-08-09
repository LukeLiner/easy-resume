from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    console_errors = []

    page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ("error", "warning") else None)
    page.on("pageerror", lambda exc: console_errors.append(f"[pageerror] {exc}"))

    page.goto("http://localhost:3000", wait_until="networkidle", timeout=60000)
    page.wait_for_timeout(3000)

    print("URL:", page.url)
    print("TITLE:", page.title())
    print("HAS LOGIN:", page.get_by_role("button").all_text_contents()[:10])
    page.screenshot(path="d:/code/github/reactive-resume/probe-home.png", full_page=False)

    print("--- CONSOLE ---")
    for line in console_errors:
        print(line)

    browser.close()
