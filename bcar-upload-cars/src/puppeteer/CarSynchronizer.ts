import { Page } from "puppeteer"
import { delay } from "../utils"

export class CarSynchronizer {
  constructor(
    private page: Page,
    private manageUrl: string,
    private existingCars: string[]
    ) {}

    async deleteExpiredCars() {
      const trTagsSelector = "#_carManagement > table > tbody > tr"
      const tdPhotoSelector = "td.photo > a > span"
      const tdCheckBoxSelector = "td.align-c > input[type=checkbox]"
      const deleteButtonSelector = "#searchListForm > div.menu-bar.mylist_toolbar.clearfix > div > button.btn_del"
      const deleteConfirmButtonSelector = "#fallr-button-confirmButton2"

      const trTags = await this.page.$$(trTagsSelector)
      const checkedCarNumsPromise = trTags.map(async (tr)=>{
        const photoTag = await tr.$(tdPhotoSelector)
        if (!photoTag) throw new Error("No photoTag tag")

        const carNum = await photoTag.evaluate(el => el.textContent)
        console.log(carNum);
        if(!carNum) throw new Error("No car number")

        const isCarExist = this.existingCars.includes(carNum)
        if (isCarExist) {
          console.log(`${carNum} exists. continue ...`);
          return ""
        }

        const checkBoxTag = await tr.$(tdCheckBoxSelector)
        if (!checkBoxTag) throw new Error("No checkbox")
        await checkBoxTag.evaluate(el => el.checked = true);
        return carNum
      })
      const checkedCarNums = (await Promise.all(checkedCarNumsPromise)).filter(e=> e.length)

      const deleteButton = await this.page.$(deleteButtonSelector)
      if (!deleteButton) throw new Error("No deleteButton")
      await deleteButton.click()

      const deleteConrirmButton = await this.page.waitForSelector(deleteConfirmButtonSelector)
      if (!deleteConrirmButton) throw new Error("No deleteConrirmButton")


      await this.page.evaluate((deleteConfirmButtonSelector)=>{
        const aButton = document.querySelector(deleteConfirmButtonSelector)
        aButton!.dispatchEvent(new Event('click', { bubbles: true }));
      }, deleteConfirmButtonSelector)
      return checkedCarNums
    }

    async getPageLength() {
      const childTags = await this.page.$$("#_carManagement > div > *")
      return childTags.length
    }

    async sync() {
      let pageNumber = await this.getPageLength()
      let deletedCarNums: string[] = []
      while (pageNumber) {
        const lastPageUrl = this.manageUrl + `?page=${pageNumber}`
        await this.page.goto(lastPageUrl, { waitUntil: "networkidle2"})
        await delay(100)
        const deletedCarNumsInPage = await this.deleteExpiredCars()
        deletedCarNums = [...deletedCarNums, ...deletedCarNumsInPage]
        pageNumber -= 1
      }
      console.log("sync done");
      return deletedCarNums
    }
}
