// Chart 3 - Doanh số bán theo Tháng

function parseNumber(v){
  if (!v) return 0;
  const s = String(v).replace(/[^\d\.\-]/g,'');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function escapeHtml(s){
  return String(s || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

d3.csv("data_ggsheet.csv").then(raw => {
  raw.forEach(d => {
    d.date = new Date(d["Thời gian tạo đơn"]);
    d.Thang = d.date.getMonth() + 1; // 1-12
  });

  // Gom theo Tháng
  const rolled = d3.rollup(
    raw,
    rows => ({
      revenue: d3.sum(rows, r => parseNumber(r["Thành tiền"])),
      qty: d3.sum(rows, r => parseNumber(r["SL"]))
    }),
    r => r.Thang
  );

  let data = Array.from(rolled, ([month,val]) => ({
    month,
    revenueMil: (val.revenue||0)/1e6,
    qty: val.qty||0,
    display: `Tháng ${month.toString().padStart(2,"0")}`
  })).filter(d=>d.revenueMil>0);

  data.sort((a,b)=> d3.ascending(a.month,b.month));

  // Layout
  const margin = { top: 40, right: 40, bottom: 70, left: 80 };
  const barWidth = 50;
  const barSpacing = 40;   // thêm biến spacing để dễ chỉnh
  const innerWidth = Math.max(1, data.length) * (barWidth + barSpacing);
  const innerHeight = 400;
  const svgW = margin.left + innerWidth + margin.right;
  const svgH = margin.top + innerHeight + margin.bottom;

  const svg = d3.select("#chart3").append("svg")
    .attr("width", svgW)
    .attr("height", svgH);

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand()
    .domain(data.map(d => d.display))
    .range([0, innerWidth])
    .padding(0.25);

  const y = d3.scaleLinear()
    .domain([0, (d3.max(data,d=>d.revenueMil) || 1) * 1.2])
    .range([innerHeight, 0])
    .nice();

  // Lưới ngang
  g.append("g")
    .attr("class", "grid")
    .call(
      d3.axisLeft(y)
        .ticks(6)
        .tickSize(-innerWidth)
        .tickFormat("")
    )
    .call(g => g.select(".domain").remove()) // bỏ trục Y phụ
    .call(g => g.selectAll("line")
      .attr("stroke", "#ccc")
      .attr("stroke-dasharray", "3,3")
    );

  // X axis (bỏ trục, chỉ giữ nhãn)
  g.append("g")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(x))
    .call(g => g.select(".domain").remove())     // bỏ line chính
    .call(g => g.selectAll("line").remove())     // bỏ tick nhỏ
    .selectAll("text")
    .style("font-size","12px")
    .style("fill","#444");

  // Y axis (bỏ trục, chỉ giữ nhãn)
  g.append("g")
    .call(d3.axisLeft(y).ticks(6).tickFormat(d => d3.format(",.0f")(d) + " M"))
    .call(g => g.select(".domain").remove())
    .call(g => g.selectAll("line").remove())
    .selectAll("text")
    .style("font-size","12px")
    .style("fill","#444");

  // Tooltip
  const tooltip = d3.select("body").append("div").attr("class","tooltip");

  // Màu
  const color = d3.scaleOrdinal()
    .domain(data.map(d=>d.month))
    .range(d3.schemeSet2); // pastel

  // Thanh
  g.selectAll(".bar")
    .data(data)
    .enter().append("rect")
    .attr("class","bar")
    .attr("x", d => x(d.display))
    .attr("y", d => y(d.revenueMil))
    .attr("width", x.bandwidth())
    .attr("height", d => innerHeight - y(d.revenueMil))
    .attr("rx",6)
    .attr("fill", d => color(d.month))
    .on("mouseover", function(evt,d){
      tooltip.style("visibility","visible").html(
        `<b>${escapeHtml(d.display)}</b><br>
         Doanh số bán: ${d3.format(",.0f")(d.revenueMil)} triệu VND<br>
         Số lượng bán: ${d3.format(",.0f")(d.qty)} SKUs`
      );
    })
    .on("mousemove", function(evt){
      tooltip.style("left",(evt.pageX+12)+"px").style("top",(evt.pageY-28)+"px");
    })
    .on("mouseout", ()=> tooltip.style("visibility","hidden"));

  // Value text trên cột (dãn ra tránh chồng)
  g.selectAll(".barValue")
    .data(data)
    .enter().append("text")
    .attr("class","barValue")
    .attr("x", d => x(d.display) + x.bandwidth()/2)
    .attr("y", d => y(d.revenueMil) - 10)   // dãn cao thêm
    .attr("text-anchor","middle")
    .style("font-size","12px")
    .style("fill","#222")
    .text(d => d3.format(",.0f")(d.revenueMil) + " triệu VND");

  // Tiêu đề
  svg.append("text")
    .attr("x", svgW/2)
    .attr("y", 22)
    .attr("text-anchor","middle")
    .style("font-size","16px")
    .style("font-weight","700")
    .text("Doanh số bán hàng theo Tháng");
});
