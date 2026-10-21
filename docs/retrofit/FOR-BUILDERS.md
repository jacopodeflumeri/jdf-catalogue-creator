# Bring your Mapp Labs app up to date — agent-assisted retrofit

*Hand this to anyone who owns an app forked from `labs-app-template`.*

The template now has a **retrofit system**. Instead of hand-porting changes, you point
your coding agent at a fresh copy of the template and it works out what your app is
missing, proposes a plan, and applies the changes **one at a time, on a branch, without
deploying**.

## Do this

1. **Clone or pull the latest `labs-app-template`** into a **separate directory** (not on
   top of your app):

   ```bash
   git clone git@github.com:mapp-digital/labs-app-template.git ~/dev/labs-app-template-latest
   # (or `git pull` in an existing clone)
   ```

2. **Open your app** (the one to upgrade) in your coding agent (Claude Code, Cursor, …).

3. In the fresh template, open **[`docs/retrofit/START-HERE.md`](START-HERE.md)**, set the
   `<TEMPLATE_PATH>` placeholder at the top to where you cloned it, and paste that prompt
   (everything between **PROMPT START** and **PROMPT END**) into your agent.

That's it. The agent takes over from there.

## What the agent does

- Detects where your fork diverged and builds an ordered, dependency-aware plan of what's
  missing.
- **Asks you which optional capabilities you want** — and warns you if skipping one
  creates *divergence debt* (future template updates assume some of them are in place).
- Applies changes **one at a time on a branch**, **generates but does not run** database
  migrations, and hands each back in plain language for review.
- **Never deploys, runs migrations, or runs AWS commands** — those are your (or a
  technical teammate's) steps, **staging first**.
- Records everything in **`.retrofit-state.json`** in your repo (what was applied,
  against which template version, and any app-specific deviations).

## You don't need to be a developer

The agent owns the git branch and migration mechanics. It explains, in plain language,
what a technical person must review before anything ships.

## What you'll need

- Your usual **AWS access** for the deploy / SSM steps.
- A few steps need the **labs-platform team** (e.g. the shared internal-API secret) or a
  **billing admin** (cost-allocation tag activation). The agent tells you exactly when.

## If you or the agent get stuck

Ask in **#topic-mapp-labs** or **#topic-ai-support**.

## Is it safe?

Yes. The agent treats the template as a *reference design* and adapts to your app — it
won't blindly overwrite your code, it works on a branch, it doesn't deploy, and it errs
toward not breaking your app. You review everything before it ships.

---

**Want to apply just one specific change** instead of the whole catch-up? See the
individual prompts in [docs/retrofit/README.md](README.md).
