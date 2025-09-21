// Q10.js
// Dashboard trực quan: "Xác suất bán theo Mặt hàng - Nhóm hàng theo Tháng"

(function () {
  const CSV_FILE = "data_ggsheet.csv";

  function parseNumber(v) {
    if (v == null) return 0;
    const s = String(v).replace(/[^\d\.\-\,]/g, "").replace(",", ".");
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // tooltip
  let tooltip = d3.select("body").select(".tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div").attr("class", "tooltip");
  }

  d3.csv(CSV_FILE).then((raw) => {
    raw.forEach((d) => {
      d.orderId = d["Mã đơn hàng"];
      d.groupId = d["Mã nhóm hàng"];
      d.groupName = d["Tên nhóm hàng"];
      d.itemId = d["Mã mặt hàng"];
      d.itemName = d["Tên mặt hàng"];
      d.date = new Date(d["Thời gian tạo đơn"]);
      d.month = d.date.getMonth() + 1;
      d.year = d.date.getFullYear();
      d.monthLabel = `T${String(d.month).padStart(2, "0")}`;
    });

    // === Logic tính xác suất theo tháng ===
    const ordersPerGroupMonth = d3.rollup(
      raw,
      (v) => new Set(v.map((d) => d.orderId)).size,
      (d) => d.groupId,
      (d) => `${d.year}-${d.month}`
    );

    const ordersPerItemMonth = d3.rollup(
      raw,
      (v) => new Set(v.map((d) => d.orderId)).size,
      (d) => d.groupId,
      (d) => d.itemId,
      (d) => `${d.year}-${d.month}`
    );

    let prob = [];
    ordersPerItemMonth.forEach((itemMap, g) => {
      itemMap.forEach((monthMap, it) => {
        monthMap.forEach((soDon, ym) => {
          const [year, month] = ym.split("-").map(Number);
          const totalOrders = ordersPerGroupMonth.get(g)?.get(ym) || 1;
          const row = raw.find(
            (r) => r.groupId === g && r.itemId === it && r.year === year && r.month === month
          ) || {};
          prob.push({
            groupId: g,
            groupName: row.groupName ?? g,
            itemId: it,
            itemName: row.itemName ?? it,
            year,
            month,
            monthLabel: `T${String(month).padStart(2, "0")}`,
            orders: soDon,
            prob: soDon / totalOrders,
          });
        });
      });
    });

    const groups = Array.from(
      d3.group(prob, (d) => d.groupId),
      ([k, v]) => ({
        id: k,
        name: v[0].groupName,
        values: v.sort((a, b) => d3.ascending(a.month, b.month)),
      })
    );

    // Grid layout
    const nCols = 3;
    const cellW = 400,
      cellH = 280;
    const svgW = nCols * cellW;
    const svgH = Math.ceil(groups.length / nCols) * cellH + 60;

    const svg = d3
      .select("#chart10")
      .append("svg")
      .attr("width", svgW)
      .attr("height", svgH);

    // Dashboard title
    svg
      .append("text")
      .attr("x", svgW / 2)
      .attr("y", 30)
      .attr("text-anchor", "middle")
      .attr("font-size", 20)
      .attr("font-weight", "700")
      .text("Xác suất bán theo Tháng cho từng Nhóm hàng");

    const color = d3.scaleOrdinal(d3.schemeSet3);

    groups.forEach((g, i) => {
      const col = i % nCols;
      const row = Math.floor(i / nCols);
      const x0 = col * cellW;
      const y0 = row * cellH + 60;

      const margin = { top: 40, right: 20, bottom: 60, left: 60 };
      const innerW = cellW - margin.left - margin.right;
      const innerH = cellH - margin.top - margin.bottom;

      const x = d3
        .scalePoint()
        .domain([...new Set(g.values.map((d) => d.monthLabel))])
        .range([0, innerW])
        .padding(0.5);

      const y = d3
        .scaleLinear()
        .domain([0, d3.max(g.values, (d) => d.prob) || 0.01])
        .nice()
        .range([innerH, 0]);

      const panel = svg
        .append("g")
        .attr("transform", `translate(${x0 + margin.left},${y0 + margin.top})`);

      // Panel title
      svg
        .append("text")
        .attr("x", x0 + cellW / 2)
        .attr("y", y0 + 20)
        .attr("text-anchor", "middle")
        .attr("font-weight", "700")
        .text(`[${g.id}] ${g.name}`);

      // Axes (màu nhạt + giãn tick Y)
      panel
        .append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x))
        .call((g) =>
          g.selectAll("text")
            .attr("transform", "rotate(45)")
            .style("text-anchor", "start")
            .style("font-size", "10px")
        )
        .call((g) =>
          g.selectAll("path, line").attr("stroke", "#ccc")
        )
        .call((g) => g.selectAll("text").attr("fill", "#444"));

      panel
        .append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")))
        .call((g) => g.selectAll("path, line").attr("stroke", "#ccc"))
        .call((g) => g.selectAll("text").attr("fill", "#444"));

      // Vẽ line cho từng item
      const items = d3.group(g.values, (d) => d.itemId);

      items.forEach((vals, it) => {
        vals = vals.sort((a, b) => d3.ascending(a.month, b.month));

        const line = d3
          .line()
          .x((d) => x(d.monthLabel))
          .y((d) => y(d.prob));

        panel
          .append("path")
          .datum(vals)
          .attr("fill", "none")
          .attr("stroke", color(it))
          .attr("stroke-width", 2)
          .attr("d", line);

        panel
          .selectAll(`.dot-${it}`)
          .data(vals)
          .enter()
          .append("circle")
          .attr("cx", (d) => x(d.monthLabel))
          .attr("cy", (d) => y(d.prob))
          .attr("r", 4)
          .attr("fill", color(it))
          .on("mouseover", (event, d) => {
            tooltip
              .style("visibility", "visible")
              .html(
                `<b>${escapeHtml(d.itemName)}</b><br/>
                 Tháng: ${d.monthLabel}<br/>
                 Đơn hàng: ${d.orders}<br/>
                 Xác suất: ${d3.format(".1%")(d.prob)}`
              );
          })
          .on("mousemove", (event) => {
            tooltip
              .style("top", event.pageY - 30 + "px")
              .style("left", event.pageX + 10 + "px");
          })
          .on("mouseout", () => tooltip.style("visibility", "hidden"));
      });
    });
  });
})();
