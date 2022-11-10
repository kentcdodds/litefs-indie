const fs = require("fs");
const { spawn } = require("child_process");

async function go() {
  try {
    const primary = await fs.promises.readFile("/litefs/data/.primary", "utf8");
    process.env.PRIMARY_REGION = primary.trim();
  } catch (error) {
    process.env.PRIMARY_REGION = process.env.FLY_REGION;
  }

  if (process.env.PRIMARY_REGION === process.env.FLY_REGION) {
    console.log(`${process.env.FLY_REGION} is primary. Deploying migrations.`);
    await deployMigrations();
  } else {
    console.log(
      `${process.env.FLY_REGION} is not primary (the primary is ${process.env.PRIMARY_REGION}). Skipping migrations.`
    );
  }
}
go();

async function deployMigrations() {
  const command = "npx prisma migrate deploy";
  const child = spawn(command, { shell: true, stdio: "inherit" });
  await new Promise((res, rej) => {
    child.on("exit", (code) => {
      if (code === 0) {
        res();
      } else {
        rej();
      }
    });
  });
}
