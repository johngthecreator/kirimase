import { consola } from "consola";
import {
  AuthSubType,
  AuthType,
  AvailablePackage,
  InitOptions,
  PMType,
  PackageType,
} from "../../types.js";
import {
  installPackages,
  installShadcnUIComponents,
  readConfigFile,
  replaceFile,
} from "../../utils.js";
import fs from "fs";
import { formatFilePath, getFilePaths } from "../filePaths/index.js";
import { spinner } from "./index.js";
import chalk from "chalk";
import { AuthProviders } from "./auth/next-auth/utils.js";

export const Packages: {
  [key in PackageType]: {
    name: string;
    value: AvailablePackage;
    disabled?: boolean;
  }[];
} = {
  orm: [
    { name: "Drizzle", value: "drizzle" },
    { name: "Prisma", value: "prisma" },
  ],
  auth: [
    { name: "Auth.js (NextAuth)", value: "next-auth" },
    { name: "Clerk", value: "clerk" },
    { name: "Lucia", value: "lucia" },
    { name: "Kinde", value: "kinde" },
  ],
  misc: [
    { name: "TRPC", value: "trpc" },
    { name: "Stripe", value: "stripe" },
    { name: "Resend", value: "resend" },
  ],
  componentLib: [{ name: "Shadcn UI (with next-themes)", value: "shadcn-ui" }],
};

export const addContextProviderToLayout = (
  provider:
    | "NextAuthProvider"
    | "TrpcProvider"
    | "ShadcnToast"
    | "ClerkProvider"
    | "Navbar"
    | "ThemeProvider"
) => {
  const { hasSrc, alias } = readConfigFile();
  const path = `${hasSrc ? "src/" : ""}app/layout.tsx`;

  const fileContent = fs.readFileSync(path, "utf-8");

  // Add import statement after the last import
  const importInsertionPoint = fileContent.lastIndexOf("import");
  const nextLineAfterLastImport =
    fileContent.indexOf("\n", importInsertionPoint) + 1;
  const beforeImport = fileContent.slice(0, nextLineAfterLastImport);
  const afterImport = fileContent.slice(nextLineAfterLastImport);

  const { trpc, "next-auth": nextAuth, shared } = getFilePaths();

  let importStatement: string;
  switch (provider) {
    case "NextAuthProvider":
      importStatement = `import NextAuthProvider from "${formatFilePath(
        nextAuth.authProviderComponent,
        { prefix: "alias", removeExtension: true }
      )}";`;
      break;
    case "TrpcProvider":
      importStatement = `import TrpcProvider from "${formatFilePath(
        trpc.trpcProvider,
        { removeExtension: true, prefix: "alias" }
      )}";\nimport { cookies } from "next/headers";`;
      break;
    case "ShadcnToast":
      importStatement = `import { Toaster } from "${alias}/components/ui/toaster";`;
      break;
    case "ClerkProvider":
      importStatement = 'import { ClerkProvider } from "@clerk/nextjs";';
      break;
    case "Navbar":
      importStatement = `import Navbar from "${formatFilePath(
        shared.init.navbarComponent,
        { prefix: "alias", removeExtension: true }
      )}";\nimport Sidebar from "${formatFilePath(
        shared.init.sidebarComponent,
        { prefix: "alias", removeExtension: true }
      )}";`;
      break;
    case "ThemeProvider":
      importStatement = `import { ThemeProvider } from "${alias}/components/ThemeProvider";`;
      break;
  }

  // check if the provider already exists
  if (fileContent.includes(importStatement)) {
    // consola.info(`Provider ${provider} already exists in layout.tsx`);
    return;
  }
  const modifiedImportContent = `${beforeImport}${importStatement}\n${afterImport}`;

  const navbarExists = fileContent.includes("<Navbar />");
  const rootChildrenText = !navbarExists
    ? "{children}"
    : `<div className="flex">\n<Sidebar />\n<main className="flex-1 md:p-8 pt-2 p-8">\n<Navbar />\n{children}\n</main>\n</div>`;
  let replacementText = "";
  switch (provider) {
    case "ShadcnToast":
      replacementText = `${rootChildrenText}\n<Toaster />\n`;
      break;
    case "Navbar":
      replacementText = `<div className="flex">\n<Sidebar />\n<main className="flex-1 md:p-8 pt-2 p-8">\n<Navbar />\n{children}\n</main>\n</div>`;
      break;
    case "ThemeProvider":
      replacementText = `\n<${provider} attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>${rootChildrenText}</${provider}>\n`;
      break;
    case "TrpcProvider":
      replacementText = `\n<${provider} cookies={cookies().toString()}>${rootChildrenText}</${provider}>\n`;
      break;
    default:
      replacementText = `\n<${provider}>${rootChildrenText}</${provider}>\n`;
      break;
  }

  const searchValue = !navbarExists
    ? "{children}"
    : `<div className="flex">\n<Sidebar />\n<main className="flex-1 md:p-8 pt-2 p-8">\n<Navbar />\n{children}\n</main>\n</div>`;
  const newLayoutContent = modifiedImportContent.replace(
    searchValue,
    replacementText
  );
  replaceFile(path, newLayoutContent);
};

export const AuthSubTypeMapping: Record<AuthType, AuthSubType> = {
  clerk: "managed",
  kinde: "managed",
  "next-auth": "self-hosted",
  lucia: "managed",
};

const installList: { regular: string[]; dev: string[] } = {
  regular: [],
  dev: [],
};

export const addToInstallList = (packages: {
  regular: string[];
  dev: string[];
}) => {
  installList.regular.push(...packages.regular);
  installList.dev.push(...packages.dev);
};

export const installPackagesFromList = async () => {
  const { preferredPackageManager } = readConfigFile();

  if (installList.dev.length === 0 && installList.regular.length === 0) return;

  const dedupedList = {
    regular: [...new Set(installList.regular)],
    dev: [...new Set(installList.dev)],
  };

  const formattedInstallList = {
    regular: dedupedList.regular
      .map((i) => i.trim())
      .join(" ")
      .trim(),
    dev: dedupedList.dev
      .map((i) => i.trim())
      .join(" ")
      .trim(),
  };
  spinner.text = "Installing Packages";
  await installPackages(formattedInstallList, preferredPackageManager);
};
const shadCnComponentList: string[] = [];
export const addToShadcnComponentList = (components: string[]) =>
  shadCnComponentList.push(...components);
export const installShadcnComponentList = async () => {
  // consola.start("Installing shadcn components:", shadCnComponentList);
  if (shadCnComponentList.length === 0) return;
  spinner.text = "Installing ShadcnUI Components";
  await installShadcnUIComponents(shadCnComponentList);
  // consola.ready("Successfully installed components.");
};

export const printNextSteps = (
  promptResponses: InitOptions,
  duration: number
) => {
  const config = readConfigFile();
  const ppm = config?.preferredPackageManager ?? "npm";

  const packagesInstalledList = [
    ...(promptResponses.orm === "drizzle"
      ? [
          `${chalk.underline("ORM")}: Drizzle (using ${
            promptResponses.dbProvider
          })`,
        ]
      : []),
    ...(promptResponses.orm === "prisma"
      ? [`${chalk.underline("ORM")}: Prisma`]
      : []),
    ...(promptResponses.auth === "next-auth"
      ? [
          `${chalk.underline(
            "Authentication"
          )}: Auth.js (with ${promptResponses.authProviders
            .map((p) => p)
            .join(", ")} providers)`,
        ]
      : []),
    ...(promptResponses.auth === "clerk"
      ? [`${chalk.underline("Authentication")}: Clerk`]
      : []),
    ...(promptResponses.auth === "lucia"
      ? [`${chalk.underline("Authentication")}: Lucia`]
      : []),
    ...(promptResponses.auth === "kinde"
      ? [`${chalk.underline("Authentication")}: Kinde`]
      : []),
    ...(promptResponses.miscPackages.includes("stripe")
      ? [`${chalk.underline("Payments")}: Stripe`]
      : []),
    ...(promptResponses.miscPackages.includes("resend")
      ? [`${chalk.underline("Email")}: Resend`]
      : []),
    ...(promptResponses.miscPackages.includes("trpc")
      ? [`${chalk.underline("RPC")}: tRPC`]
      : []),
    ...(promptResponses.componentLib === "shadcn-ui"
      ? [`${chalk.underline("Component Library")}: ShadcnUI`]
      : []),
  ];

  const wouldHaveSecrets =
    promptResponses.orm ||
    promptResponses.auth ||
    promptResponses.miscPackages.includes("resend") ||
    promptResponses.miscPackages.includes("stripe");

  const dbMigration = [
    `Run '${ppm} run db:generate'`,
    `Run '${ppm} run db:${promptResponses.db === "pg" ? "migrate" : "push"}'`,
    `Run '${ppm} run dev'`,
    "Open localhost:3000/ in your browser",
  ];
  const runMigration =
    promptResponses.orm ||
    promptResponses.auth === "lucia" ||
    promptResponses.auth === "next-auth" ||
    promptResponses.miscPackages.includes("stripe");

  const nextSteps = [
    ...(wouldHaveSecrets ? ["Add Environment Variables to your .env"] : []),
    ...(runMigration ? dbMigration : []),
    "Build something awesome!",
  ];

  const authProviderInstructions =
    promptResponses.authProviders && promptResponses.authProviders.length > 0
      ? promptResponses.authProviders.map((provider) => {
          return `${provider} auth: create credentials at ${AuthProviders[provider].website}\n  (redirect URI: /api/auth/callback/${provider})`;
        })
      : [];

  const notes = [
    ...authProviderInstructions,
    "If you had any problems, please open an issue on GitHub\n  (https://github.com/nicoalbanese/kirimase/issues)",
  ];

  showNextSteps(packagesInstalledList, nextSteps, notes, duration);
};
const createNextStepsList = (steps: string[]) => {
  return `
${chalk.bold.underline("Next Steps")}
${steps.map((item, i) => `${i + 1}. ${item}`).join("\n")}`;
};

const createNotesList = (notes: string[]) => {
  return `
${chalk.bold.underline("Notes")}
${notes.map((item) => `- ${item}`).join("\n")}`;
};

const formatInstallList = (installList: string[]) => {
  return `${"The following packages are now installed and configured:"}
- ${installList.join("\n- ")}`;
};

export const showNextSteps = (
  installList: string[],
  steps: string[],
  notes: string[],
  duration: number
) => {
  const nextStepsFormatted = `🚀 Thanks for using Kirimase to kickstart your Next.js app!

${formatInstallList(installList)}

${chalk.bgGreen.black(
  `[installed and configured in just ${duration / 1000} seconds]`
)}
${createNextStepsList(steps)}
${notes.length > 0 ? createNotesList(notes) : ""}
`;
  consola.box(nextStepsFormatted);
};
