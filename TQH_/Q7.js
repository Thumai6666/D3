// chart7.js
// Biểu đồ xác suất bán hàng theo Nhóm hàng (theo công thức Pandas + trực quan đẹp)

function parseNumber(v) {
  if (v == null) return 0;
  const s = String(v).replace(/[^\d\.\-]/g, "");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const csvFile7 = "data_ggsheet.csv";

function drawChart7(csvFile = csvFile7) {
  d3.csv(csvFile).then(dataset => {
    // Tổng số đơn hàng duy nhất
    const totalOrders = new Set(dataset.map(d => d["Mã đơn hàng"])).size || 1;

    // Gom nhóm
    const groupMap = d3.rollup(
      dataset,
      rows => {
        const orderCount = new Set(rows.map(r => r["Mã đơn hàng"])).size;
        const revenue = d3.sum(rows, r => parseNumber(r["Thành tiền"]));
        return { orderCount, revenue };
      },
      d => d["Mã nhóm hàng"],
      d => d["Tên nhóm hàng"]
    );

    const data = [];
    for (let [ma, sub] of groupMap.entries()) {
      for (let [ten, val] of sub.entries()) {
        data.push({
          groupKey: `[${ma}] ${ten}`,
          orderCount: val.orderCount,
          revenue: val.revenue,
          probability: val.orderCount / totalOrders
        });
      }
    }

    data.sort((a, b) => d3.descending(a.probability, b.probability));

    // Layout
    const margin = { top: 50, right: 150, bottom: 60, left: 250 };
    const innerWidth = 1000;
    const innerHeight = Math.max(250, data.length * 50);
    const svgW = margin.left + innerWidth + margin.right;
    const svgH = margin.top + innerHeight + margin.bottom;

    d3.select("#chart7").selectAll("*").remove();
    const svg = d3.select("#chart7").append("svg")
      .attr("width", svgW)
      .attr("height", svgH);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const y = d3.scaleBand()
      .domain(data.map(d => d.groupKey))
      .range([0, innerHeight])
      .padding(0.25);

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.probability) || 1]).nice()
      .range([0, innerWidth]);

    // Grid
    g.append("g")
      .call(d3.axisBottom(x).ticks(6).tickSize(innerHeight).tickFormat(""))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line")
        .attr("stroke", "#e0e0e0")
        .attr("stroke-dasharray", "3,3")
      );

    // Nhãn nhóm
    g.selectAll(".yLabel")
      .data(data)
      .enter().append("text")
      .attr("class", "yLabel")
      .attr("x", -12)
      .attr("y", d => y(d.groupKey) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "end")
      .text(d => d.groupKey);

    // Trục X
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x).tickFormat(d => (d * 100).toFixed(0) + "%"))
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll("line").remove());

    // Tooltip (dùng lại CSS cũ)
    let tooltip = d3.select("body").select(".tooltip");
    if (tooltip.empty()) tooltip = d3.select("body").append("div").attr("class", "tooltip");

    const colors = d3.scaleOrdinal()
      .domain(data.map(d => d.groupKey))
      .range(d3.schemeSet2);

    // Vẽ bar
    g.selectAll(".bar")
      .data(data)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("y", d => y(d.groupKey))
      .attr("x", 0)
      .attr("height", y.bandwidth())
      .attr("width", d => x(d.probability))
      .attr("fill", d => colors(d.groupKey))
      .attr("rx", 6)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("fill", d3.color(colors(d.groupKey)).darker(0.6));
        tooltip.style("visibility", "visible").html(`
          <b>${escapeHtml(d.groupKey)}</b><br/>
          Số lượng đơn bán: ${d3.format(",")(d.orderCount)} SKUs<br/>
          Xác suất bán: ${(d.probability * 100).toFixed(2)}%
        `);
      })
      .on("mousemove", event => {
        tooltip.style("left", (event.pageX + 15) + "px")
               .style("top", (event.pageY - 20) + "px");
      })
      .on("mouseout", function (event, d) {
        d3.select(this).attr("fill", colors(d.groupKey));
        tooltip.style("visibility", "hidden");
      });

    // Label % ngoài bar
    g.selectAll(".barValue")
      .data(data)
      .enter().append("text")
      .attr("class", "barValue")
      .attr("x", d => x(d.probability) + 8)
      .attr("y", d => y(d.groupKey) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .text(d => (d.probability * 100).toFixed(1) + "%");

    // Title
    svg.append("text")
      .attr("x", svgW / 2)
      .attr("y", 28)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "700")
      .text("Xác suất bán hàng theo Nhóm hàng");
  });
}

drawChart7();
