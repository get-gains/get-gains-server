import { styleText } from 'node:util';

export const logPath = (method: string, path: string, statusCode: number) => {
  const styledMethod = styleText(['cyan', 'bold'], method);
  const styledPath = styleText('green', path);
  const styledStatus =
    statusCode >= 400
      ? styleText(['red', 'bold'], statusCode.toString())
      : styleText(['yellow', 'bold'], statusCode.toString());
  console.log(`${styledMethod} ${styledPath} ${styledStatus}`);
};
