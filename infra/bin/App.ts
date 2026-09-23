import {App} from "aws-cdk-lib";

import {LedgerStack} from "@src/LedgerStack";

const app = new App();
new LedgerStack(app, "LedgerStack");
