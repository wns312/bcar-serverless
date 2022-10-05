import { APIGatewayEvent, Context } from "aws-lambda";
import { test } from "./puppeteer/crawl";
exports.hello = async (
  event: APIGatewayEvent,
  context: Context
  // callback: Function
) => {
  await test();
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: "Go Serverless v3.0! Your function executed successfully!",
        input: event,
      },
      null,
      2
    ),
  };
};
