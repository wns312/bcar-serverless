import { APIGatewayEvent, Context } from "aws-lambda";
import { CarCrawler } from './puppeteer/crawl'
import { envs } from './configs'



exports.hello = async (
  event: APIGatewayEvent,
  context: Context
  // callback: Function
) => {
  const crawler = new CarCrawler(envs)
  await crawler.crawlCarList()
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
