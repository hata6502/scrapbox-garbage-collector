const { parse } = require("@progfay/scrapbox-parser");
const fs = require("fs");

const main = async () => {
  const apiResponse = JSON.parse(
    await fs.promises.readFile(process.argv[2], "utf8")
  );

  const exportedData = JSON.parse(
    await fs.promises.readFile(process.argv[3], "utf8")
  );

  const linkMap = new Map(
    exportedData.pages.map((page) => [
      page.title,
      getLinks({ lines: page.lines }),
    ])
  );

  linkMap.forEach((links, title) => {
    links.forEach((link) => {
      const targetLinks = linkMap.get(link);

      if (!targetLinks) {
        return;
      }

      linkMap.set(link, [...new Set([...targetLinks, title])]);
    });
  });

  // ピンされたページが 100 件を超えることは想定しない。
  const pinnedPages = apiResponse.pages.filter((page) => page.pin > 0);
  const queue = pinnedPages.map((pinnedPage) => pinnedPage.title);
  const links = [];
  let link;

  while ((link = queue.shift()) !== undefined) {
    if (links.includes(link)) {
      continue;
    }

    links.push(link);

    const newLinks = linkMap.get(link);

    if (!newLinks) {
      continue;
    }

    queue.push(...newLinks);
  }

  // TODO: エスケープ
  const userCSS = `code: style.css
    ${links
      .map((link) => `.page-list-item[data-page-title="${link}"]`)
      .join()} {
      display: none !important;
    }`;

  console.log(userCSS);
};

main();

const getLinks = ({ lines }) => {
  const page = parse(lines.join("\n"));

  const topLevelNodes = page.flatMap((block) => {
    switch (block.type) {
      case "title": {
        return [];
      }

      case "codeBlock": {
        return [];
      }

      case "table": {
        return block.cells.flat().flat();
      }

      case "line": {
        return block.nodes;
      }

      default: {
        // TODO: exhaustive check
      }
    }
  });

  const flattenNodes = [];

  const flatNode = ({ node }) => {
    flattenNodes.push(node);

    switch (node.type) {
      case "decoration":
      case "quote":
      case "strong": {
        node.nodes.forEach((node) => flatNode({ node }));
      }

      default: {
        // TODO: exhaustive check
      }
    }
  };

  topLevelNodes.forEach((node) => flatNode({ node }));

  const links = flattenNodes.flatMap((node) => {
    switch (node.type) {
      case "hashTag": {
        const link = node.href.replace(/_/g, " ");

        return [link];
      }

      case "link": {
        if (node.pathType !== "relative") {
          return [];
        }

        return [node.href];
      }

      default: {
        // TODO: exhaustive check
        return [];
      }
    }
  });

  return [...new Set(links)];
};
