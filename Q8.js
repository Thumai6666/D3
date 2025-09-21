// Q8.js
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

/* CONFIG */
const csvFile8 = "data_ggsheet.csv";
/* END CONFIG */

function drawChart8(csvFile = csvFile8) {
  d3.csv(csvFile).then(dataset => {
    // Parse dữ liệu
    dataset.forEach(d => {
      d["Thời gian tạo đơn"] = new Date(d["Thời gian tạo đơn"]);
      d["SL"] = parseNumber(d["SL"]);
      d["Thành tiền"] = parseNumber(d["Thành tiền"]);
      const m = d["Thời gian tạo đơn"].getMonth() + 1;
      d["Tháng"] = "Tháng " + String(m).padStart(2, "0");
    });

    // Tổng số đơn hàng theo tháng
    const ordersPerMonth = d3.rollup(
      dataset,
      v => new Set(v.map(x => x["Mã đơn hàng"])).size,
      d => d["Tháng"]
    );

    // Gom theo Tháng + Nhóm hàng
    const perGroupMonth = d3.rollups(
      dataset,
      v => ({
        soDon: new Set(v.map(x => x["Mã đơn hàng"])).size,
        doanhThu: d3.sum(v, x => x["Thành tiền"]),
        soLuong: d3.sum(v, x => x["SL"]),
        tenNhom: v[0]["Tên nhóm hàng"]
      }),
      d => d["Tháng"],
      d => d["Mã nhóm hàng"]
    );

    // Flatten
    let data = [];
    perGroupMonth.forEach(([thang, groups]) => {
      const tongDon = ordersPerMonth.get(thang) || 1;
      groups.forEach(([maNhom, vals]) => {
        data.push({
          Tháng: thang,
          Mã: maNhom,
          Nhóm: `[${maNhom}] ${vals.tenNhom}`,
          "Số đơn": vals.soDon,
          "Doanh thu": vals.doanhThu,
          "SL": vals.soLuong,
          "Xác suất": vals.soDon / tongDon
        });
      });
    });

    // Sort theo tháng
    const months = [...new Set(data.map(d => d.Tháng))].sort();

    // Nhóm theo Nhóm hàng
    const nested = d3.group(data, d => d.Nhóm);

    // Layout
    const margin = { top: 50, right: 180, bottom: 60, left: 70 };
    const innerW = 900;
    const innerH = 500;
    const svgW = innerW + margin.left + margin.right;
    const svgH = innerH + margin.top + margin.bottom;

    d3.select("#chart8").selectAll("*").remove();
    const svg = d3.select("#chart8").append("svg")
      .attr("width", svgW)
      .attr("height", svgH);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales
    const x = d3.scalePoint().domain(months).range([0, innerW]).padding(0.5);
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d["Xác suất"])]).nice()
      .range([innerH, 0]);

    const color = d3.scaleOrdinal(d3.schemeSet2).domain([...nested.keys()]);

    // Line generator
    const line = d3.line()
      .x(d => x(d.Tháng))
      .y(d => y(d["Xác suất"]));

    // Tooltip
    let tooltip = d3.select("body").select(".tooltip");
    if (tooltip.empty()) {
      tooltip = d3.select("body").append("div").attr("class", "tooltip");
    }

    // Vẽ line cho từng nhóm
    nested.forEach((values, key) => {
      values.sort((a, b) => d3.ascending(a.Tháng, b.Tháng));

      g.append("path")
        .datum(values)
        .attr("fill", "none")
        .attr("stroke", color(key))
        .attr("stroke-width", 2)
        .attr("d", line);

      // markers
      g.selectAll(`.dot-${key}`)
        .data(values)
        .enter()
        .append("circle")
        .attr("class", `dot-${key}`)
        .attr("cx", d => x(d.Tháng))
        .attr("cy", d => y(d["Xác suất"]))
        .attr("r", 5)
        .attr("fill", color(key))
        .on("mouseover", function (event, d) {
          tooltip.style("visibility", "visible").html(`
            <b>${d.Tháng} | ${escapeHtml(d.Nhóm)}</b><br/>
            Xác suất bán: ${(d["Xác suất"]*100).toFixed(1)}%<br/>
            Số đơn bán: ${d["Số đơn"]} SKUs
          `);
        })
        .on("mousemove", function (event) {
          tooltip.style("left", (event.pageX + 15) + "px")
                 .style("top", (event.pageY - 20) + "px");
        })
        .on("mouseout", function () {
          tooltip.style("visibility", "hidden");
        });
    });

    // Trục X chỉ giữ label
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSize(0))
      .call(g => g.select(".domain").remove());

    // Trục Y chỉ giữ label + lưới ngang
    g.append("g")
      .call(d3.axisLeft(y).tickFormat(d3.format(".0%")).tickSize(0))
      .call(g => g.select(".domain").remove());

    // Gridlines ngang
    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y)
        .tickSize(-innerW)
        .tickFormat("")
      )
      .call(g => g.select(".domain").remove())
      .selectAll("line")
      .attr("stroke", "#999")
      .attr("stroke-dasharray", "4 4")
      .attr("stroke-opacity", 0.5);

    // Title
    svg.append("text")
      .attr("x", svgW/2).attr("y", 28)
      .attr("text-anchor", "middle")
      .style("font-size", "18px").style("font-weight", "700")
      .text("Xác suất bán hàng theo Nhóm hàng theo Tháng");

    // Legend
    const legend = svg.append("g")
      .attr("transform", `translate(${innerW + margin.left + 20}, ${margin.top})`);

    let i = 0;
    nested.forEach((_, key) => {
      const gLegend = legend.append("g").attr("transform", `translate(0, ${i*20})`);
      gLegend.append("rect").attr("width", 12).attr("height", 12).attr("fill", color(key));
      gLegend.append("text").attr("x", 18).attr("y", 10).text(key).style("font-size", "12px");
      i++;
    });
  });
}

drawChart8();
