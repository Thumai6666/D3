// Q12.js
// Phân phối mức chi trả của khách hàng (tổng chi tiêu theo khách -> số lượng khách theo bin)

d3.csv("data_ggsheet.csv").then(raw => {
  // --- Chuẩn hóa & lọc ---
  const rows = raw.filter(d => d["Mã khách hàng"] && d["Thành tiền"]);
  const spendingByCustomer = new Map();

  rows.forEach(r => {
    const cid = r["Mã khách hàng"];
    const revenue = +r["Thành tiền"];
    if (!spendingByCustomer.has(cid)) spendingByCustomer.set(cid, 0);
    spendingByCustomer.set(cid, spendingByCustomer.get(cid) + revenue);
  });

  const spendings = Array.from(spendingByCustomer.values());

  if (spendings.length === 0) {
    d3.select("#chart12").append("div").text("Không có dữ liệu hợp lệ.");
    return;
  }

  // --- Phân bin (50,000 VND 1 bin) ---
  const binSize = 50000; // 50k
  const maxSpend = d3.max(spendings);
  const bins = d3.bin()
    .thresholds(d3.range(0, maxSpend + binSize, binSize))
    (spendings);

  const data = bins.map(b => ({
    label: `${b.x0/1000}K`,   // chỉ lấy mốc bắt đầu của bin
    count: b.length,
    x0: b.x0,
    x1: b.x1
  }));

  // --- Layout ---
  d3.select("#chart12").selectAll("*").remove();
  const containerNode = d3.select("#chart12").node();
  const containerW = containerNode ? containerNode.getBoundingClientRect().width : 1200;

  const margin = { top: 40, right: 20, bottom: 100, left: 80 };
  const svgW = Math.max(800, containerW);
  const width = svgW - margin.left - margin.right;
  const height = 520 - margin.top - margin.bottom;

  const svg = d3.select("#chart12")
    .append("svg")
    .attr("width", svgW)
    .attr("height", height + margin.top + margin.bottom);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // --- Scales ---
  const x = d3.scaleBand()
    .domain(data.map(d => d.label))
    .range([0, width])
    .padding(0.1);

  const yMax = d3.max(data, d => d.count);
  const y = d3.scaleLinear()
    .domain([0, yMax * 1.06])
    .nice()
    .range([height, 0]);

  // --- Grid ngang ---
  g.append("g")
    .attr("class", "grid")
    .call(d3.axisLeft(y)
      .ticks(6)
      .tickSize(-width)
      .tickFormat(""))
    .call(g => g.select(".domain").remove())
    .selectAll("line")
    .attr("stroke", "#ddd")
    .attr("stroke-dasharray", "4,4");

  // --- Bars ---
  const bar = g.selectAll(".bar")
    .data(data)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.label))
    .attr("y", d => y(d.count))
    .attr("width", x.bandwidth())
    .attr("height", d => Math.max(0, height - y(d.count)))
    .attr("rx", 4)
    .attr("fill", "#4a90e2");

  // --- Tooltip ---
  const tooltip = d3.select("body").select(".tooltip");
  if (tooltip.empty()) {
    d3.select("body").append("div").attr("class", "tooltip");
  }
  const tsel = d3.select("body").select(".tooltip");

  bar.on("mouseover", function(event, d) {
      d3.select(this).attr("fill", d3.color("#4a90e2").darker(0.6));
      tsel.style("visibility", "visible")
        .html(`<b>Từ ${d3.format(",")(d.x0)} – ${d3.format(",")(d.x1)} VND</b><br/>Số lượng KH: ${d3.format(",")(d.count)}`);
    })
    .on("mousemove", function(event) {
      tsel.style("left", (event.pageX + 12) + "px")
         .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function() {
      d3.select(this).attr("fill", "#4a90e2");
      tsel.style("visibility", "hidden");
    });

  // --- Trục X ---
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x)
      .tickValues(x.domain().filter((d,i) => !(i%2)))) // hiển thị cách 2 bin
    .call(g => g.selectAll("path, line").attr("stroke", "#bbb"))
    .selectAll("text")
    .style("font-size", "11px")
    .style("fill", "#333")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  // --- Trục Y ---
  g.append("g")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(",")))
    .call(g => g.selectAll("path, line").attr("stroke", "#bbb"))
    .selectAll("text")
    .style("font-size", "12px")
    .style("fill", "#333");

  // --- Tiêu đề ---
  svg.append("text")
    .attr("x", svgW / 2)
    .attr("y", 22)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "700")
    .text("Phân phối mức chi trả của khách hàng");

  // --- Nhãn trục ---
  svg.append("text")
    .attr("x", margin.left + width / 2)
    .attr("y", height + margin.top + 80)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .text("Mức chi tiêu (VND)");

  svg.append("text")
    .attr("transform", `translate(14, ${margin.top + height/2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .style("font-size", "13px")
    .text("Số khách hàng");
});
